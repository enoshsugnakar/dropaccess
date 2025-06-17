import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { WEBHOOK_EVENTS } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';
import { Webhook } from 'standardwebhooks';

// Initialize webhook verifier
let webhook: Webhook | null = null;
try {
  if (process.env.DODO_PAYMENTS_WEBHOOK_SECRET) {
    webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_SECRET);
  } else {
    console.error('❌ DODO_PAYMENTS_WEBHOOK_SECRET environment variable not set');
  }
} catch (error) {
  console.error('❌ Failed to initialize webhook verifier:', error);
}

interface WebhookHeaders {
  'webhook-id': string;
  'webhook-signature': string;
  'webhook-timestamp': string;
}

interface WebhookPayload {
  type: string;
  data: {
    // Actual Dodo Payments payload structure
    payload_type?: string;
    subscription_id?: string;
    payment_id?: string;
    customer?: {
      customer_id: string;
      name: string;
      email: string;
    };
    
    // Subscription fields
    recurring_pre_tax_amount?: number;
    tax_inclusive?: boolean;
    currency?: string;
    status?: string;
    created_at?: string;
    product_id?: string;
    quantity?: number;
    next_billing_date?: string;
    previous_billing_date?: string;
    cancel_at_next_billing_date?: boolean;
    cancelled_at?: string;
    
    // Payment fields
    total_amount?: number;
    payment_method?: string;
    settlement_amount?: number;
    
    // Common fields
    metadata?: {
      user_id: string;
      plan: string;
      app_name?: string;
      is_plan_change?: string;
      previous_plan?: string;
    };
    billing?: {
      country: string;
      state: string;
      city: string;
      street: string;
      zipcode: string;
    };
    
    // Legacy support for nested structure
    subscription?: {
      subscription_id: string;
      customer_id: string;
      product_id: string;
      status: string;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      canceled_at?: string;
      metadata?: {
        user_id: string;
        plan: string;
        app_name?: string;
        is_plan_change?: string;
        previous_plan?: string;
      };
    };
    payment?: {
      payment_id: string;
      customer_id: string;
      amount: number;
      currency: string;
      status: string;
      subscription_id?: string;
      metadata?: {
        user_id: string;
        plan: string;
      };
    };
    
    // Fallback fields
    customer_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    amount?: number;
  };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`🎣 [${requestId}] Webhook received at:`, new Date().toISOString());
  
  try {
    // Check critical dependencies
    if (!supabaseAdmin) {
      console.error(`❌ [${requestId}] supabaseAdmin not configured`);
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    if (!webhook) {
      console.error(`❌ [${requestId}] Webhook verifier not initialized`);
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      );
    }

    // Get raw body for signature verification
    const body = await request.text();
    if (!body) {
      console.error(`❌ [${requestId}] Empty request body`);
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    console.log(`📦 [${requestId}] Webhook body length:`, body.length);

    // Extract webhook headers following Dodo Payments standard
    const webhookHeaders: WebhookHeaders = {
      'webhook-id': request.headers.get('webhook-id') || '',
      'webhook-signature': request.headers.get('webhook-signature') || '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') || ''
    };

    // Validate required headers
    if (!webhookHeaders['webhook-id'] || !webhookHeaders['webhook-signature'] || !webhookHeaders['webhook-timestamp']) {
      console.error(`❌ [${requestId}] Missing required webhook headers:`, {
        hasId: !!webhookHeaders['webhook-id'],
        hasSignature: !!webhookHeaders['webhook-signature'],
        hasTimestamp: !!webhookHeaders['webhook-timestamp']
      });
      return NextResponse.json(
        { error: 'Missing required webhook headers' },
        { status: 400 }
      );
    }

    console.log(`🔑 [${requestId}] Webhook headers received:`, {
      id: webhookHeaders['webhook-id'],
      timestamp: webhookHeaders['webhook-timestamp'],
      signatureLength: webhookHeaders['webhook-signature'].length
    });

    // Parse payload before verification to check structure
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(body);
      if (!payload.type || !payload.data) {
        throw new Error('Invalid payload structure: missing type or data');
      }
    } catch (parseError) {
      console.error(`❌ [${requestId}] Failed to parse webhook payload:`, parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    console.log(`📄 [${requestId}] Parsed webhook payload:`, {
      type: payload.type,
      subscriptionId: payload.data?.subscription_id,
      paymentId: payload.data?.payment_id,
      customerId: payload.data?.customer?.customer_id,
      userId: payload.data?.metadata?.user_id
    });

    // Verify webhook signature - CRITICAL for security
    try {
      await webhook.verify(body, webhookHeaders);
      console.log(`✅ [${requestId}] Webhook signature verified successfully`);
    } catch (verificationError) {
      console.error(`❌ [${requestId}] Webhook signature verification failed:`, verificationError);
      
      // Only allow bypass in development with explicit flag
      if (process.env.NODE_ENV === 'development' && process.env.DODO_SKIP_WEBHOOK_VERIFICATION === 'true') {
        console.warn(`⚠️ [${requestId}] Bypassing verification in development mode`);
      } else {
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 401 }
        );
      }
    }

    const { type, data } = payload;

    // Handle webhook events with proper error isolation
    let handlerResult = { success: false, message: '' };

    try {
      switch (type) {
        case WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        case 'subscription.created':
          console.log(`🚀 [${requestId}] Processing subscription.created`);
          await handleSubscriptionCreated(data, requestId);
          handlerResult = { success: true, message: 'Subscription created successfully' };
          break;
          
        case WEBHOOK_EVENTS.SUBSCRIPTION_RENEWED:
        case 'subscription.renewed':
        case 'subscription.renew':
          console.log(`🔄 [${requestId}] Processing subscription renewal`);
          await handleSubscriptionRenewed(data, requestId);
          handlerResult = { success: true, message: 'Subscription renewed successfully' };
          break;
          
        case 'subscription.active':
          console.log(`✅ [${requestId}] Processing subscription.active`);
          await handleSubscriptionActive(data, requestId);
          handlerResult = { success: true, message: 'Subscription activated successfully' };
          break;
          
        case WEBHOOK_EVENTS.PAYMENT_SUCCEEDED:
        case 'payment.succeeded':
          console.log(`💰 [${requestId}] Processing payment.succeeded`);
          await handlePaymentSucceeded(data, requestId);
          handlerResult = { success: true, message: 'Payment processed successfully' };
          break;
          
        case WEBHOOK_EVENTS.SUBSCRIPTION_CANCELED:
        case 'subscription.canceled':
          console.log(`❌ [${requestId}] Processing subscription.canceled`);
          await handleSubscriptionCanceled(data, requestId);
          handlerResult = { success: true, message: 'Subscription cancellation processed' };
          break;
          
        case WEBHOOK_EVENTS.PAYMENT_FAILED:
        case 'payment.failed':
          console.log(`💸 [${requestId}] Processing payment.failed`);
          await handlePaymentFailed(data, requestId);
          handlerResult = { success: true, message: 'Payment failure tracked' };
          break;
          
        default:
          console.log(`❓ [${requestId}] Unhandled webhook type:`, type);
          console.log(`📄 [${requestId}] Full payload for unhandled event:`, JSON.stringify(payload, null, 2));
          handlerResult = { success: true, message: `Unhandled event type: ${type}` };
      }
    } catch (handlerError) {
      console.error(`❌ [${requestId}] Handler error for ${type}:`, handlerError);
      // Don't fail the webhook for handler errors - return success to prevent retries
      handlerResult = { success: true, message: `Handler error logged for ${type}` };
    }

    console.log(`✅ [${requestId}] Webhook processing completed:`, handlerResult.message);
    
    return NextResponse.json({ 
      success: true, 
      message: handlerResult.message,
      type: type,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Critical webhook error:`, error);
    return NextResponse.json(
      { 
        error: 'Internal webhook processing error',
        requestId: requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handleSubscriptionCreated`);
    return;
  }

  // Extract subscription data from actual Dodo payload structure
  const customerId = data.customer?.customer_id || data.customer_id;
  const userEmail = data.customer?.email;
  
  const subscription = data.subscription || {
    subscription_id: data.subscription_id!,
    customer_id: customerId!,
    product_id: data.product_id!,
    status: data.status!,
    current_period_start: data.created_at || data.current_period_start!,
    current_period_end: data.next_billing_date || data.current_period_end!,
    cancel_at_period_end: data.cancel_at_next_billing_date || false,
    metadata: data.metadata
  };

  if (!subscription.subscription_id || !customerId) {
    console.error(`❌ [${requestId}] Missing required subscription data:`, {
      hasSubscriptionId: !!subscription.subscription_id,
      hasCustomerId: !!customerId,
      rawData: data
    });
    return;
  }

  console.log(`📝 [${requestId}] Processing subscription created:`, {
    subscriptionId: subscription.subscription_id,
    customerId: customerId,
    productId: subscription.product_id,
    status: subscription.status,
    metadata: subscription.metadata,
    userEmail: userEmail
  });

  const { user_id: userId, plan, is_plan_change } = subscription.metadata || {};
  
  if (!userId) {
    console.error(`❌ [${requestId}] No user_id in subscription metadata:`, subscription.metadata);
    return;
  }

  try {
    // STEP 1: Test database connection
    console.log(`🔍 [${requestId}] Testing database connection...`);
    const { data: testQuery, error: testError } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error(`❌ [${requestId}] Database connection test failed:`, testError);
      throw new Error(`Database connection failed: ${testError.message}`);
    }
    console.log(`✅ [${requestId}] Database connection successful`);

    // STEP 2: Check if user exists before fetching details
    console.log(`🔍 [${requestId}] Checking if user exists: ${userId}`);
    const { data: userExists, error: userExistsError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userExistsError) {
      console.error(`❌ [${requestId}] User existence check failed:`, userExistsError);
      
      // If user doesn't exist, create them first
      if (userExistsError.code === 'PGRST116') {
        console.log(`📝 [${requestId}] User not found, creating user: ${userId}`);
        
        const { data: newUser, error: createUserError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: userEmail || 'unknown@email.com',
            is_paid: false,
            subscription_status: 'free',
            subscription_tier: 'free'
          })
          .select()
          .single();

        if (createUserError) {
          console.error(`❌ [${requestId}] Failed to create user:`, createUserError);
          throw createUserError;
        }
        console.log(`✅ [${requestId}] User created successfully:`, newUser);
      } else {
        throw userExistsError;
      }
    }

    // STEP 3: Fetch user details
    console.log(`🔍 [${requestId}] Fetching user details: ${userId}`);
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, subscription_tier, is_paid, dodo_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error(`❌ [${requestId}] Error fetching user after creation:`, userError);
      throw userError || new Error('User not found after creation');
    }

    const finalUserEmail = user.email || userEmail || 'unknown@email.com';
    const isUpgrade = is_plan_change === 'true';
    
    console.log(`👤 [${requestId}] User details:`, { 
      userId, 
      userEmail: finalUserEmail, 
      currentTier: user.subscription_tier,
      newPlan: plan,
      isUpgrade,
      existingDodoCustomerId: user.dodo_customer_id
    });

    // STEP 4: Update user subscription status with detailed logging
    const userUpdateData = {
      is_paid: true,
      subscription_status: 'active',
      subscription_tier: plan || 'individual',
      subscription_ends_at: subscription.current_period_end,
      dodo_customer_id: customerId,
      updated_at: new Date().toISOString()
    };

    console.log(`📝 [${requestId}] Updating user with data:`, userUpdateData);

    const { data: updatedUser, error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update(userUpdateData)
      .eq('id', userId)
      .select('id, subscription_tier, is_paid, subscription_status, dodo_customer_id');

    if (userUpdateError) {
      console.error(`❌ [${requestId}] Error updating user:`, userUpdateError);
      console.error(`❌ [${requestId}] Update data that failed:`, userUpdateData);
      console.error(`❌ [${requestId}] User ID that failed:`, userId);
      throw userUpdateError;
    }

    console.log(`✅ [${requestId}] User updated successfully:`, updatedUser);

    // STEP 5: Verify the update worked
    const { data: verifyUser, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('subscription_tier, is_paid, subscription_status, dodo_customer_id')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error(`❌ [${requestId}] Error verifying user update:`, verifyError);
    } else {
      console.log(`🔍 [${requestId}] User verification after update:`, verifyUser);
      
      // Check if the update actually worked
      if (verifyUser.subscription_tier !== (plan || 'individual')) {
        console.error(`❌ [${requestId}] User tier not updated! Expected: ${plan || 'individual'}, Got: ${verifyUser.subscription_tier}`);
      } else {
        console.log(`✅ [${requestId}] User tier successfully updated to: ${verifyUser.subscription_tier}`);
      }
    }

    // STEP 6: Handle subscription record - upsert pattern
    const subscriptionData = {
      user_id: userId,
      plan: plan || 'individual',
      status: 'active',
      dodo_customer_id: customerId,
      dodo_subscription_id: subscription.subscription_id,
      dodo_product_id: subscription.product_id,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      billing_interval: 'monthly',
      expires_at: subscription.current_period_end,
      price_cents: plan === 'business' ? 1999 : 999,
      updated_at: new Date().toISOString()
    };

    console.log(`📝 [${requestId}] Creating/updating subscription record:`, subscriptionData);

    // Check for existing subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();

    let subscriptionResult;
    if (existingSubscription) {
      // Update existing subscription
      subscriptionResult = await supabaseAdmin
        .from('subscriptions')
        .update(subscriptionData)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      // Create new subscription
      subscriptionResult = await supabaseAdmin
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          started_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (subscriptionResult.error) {
      console.error(`❌ [${requestId}] Error upserting subscription:`, subscriptionResult.error);
      // Don't throw here, user update is more important
    } else {
      console.log(`✅ [${requestId}] Subscription record processed successfully`);
    }

    // STEP 7: Track the event
    try {
      const eventName = isUpgrade ? 'subscription_upgraded' : 'subscription_created';
      await captureEvent(finalUserEmail, eventName, {
        plan: plan || 'individual',
        subscription_id: subscription.subscription_id,
        customer_id: customerId,
        current_period_end: subscription.current_period_end,
        user_id: userId,
        is_upgrade: isUpgrade,
        previous_tier: user.subscription_tier
      });
      console.log(`✅ [${requestId}] Event tracked: ${eventName}`);
    } catch (trackingError) {
      console.error(`❌ [${requestId}] Event tracking failed:`, trackingError);
      // Don't throw, tracking is not critical
    }

    console.log(`✅ [${requestId}] Subscription ${isUpgrade ? 'upgrade' : 'creation'} completed for user: ${userId}`);

  } catch (error) {
    console.error(`❌ [${requestId}] Critical error in handleSubscriptionCreated:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}

async function handleSubscriptionActive(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handleSubscriptionActive`);
    return;
  }

  // Extract subscription data from actual Dodo payload structure
  const customerId = data.customer?.customer_id || data.customer_id;
  const userEmail = data.customer?.email;
  
  const subscription = data.subscription || {
    subscription_id: data.subscription_id!,
    customer_id: customerId!,
    product_id: data.product_id!,
    status: data.status!,
    current_period_start: data.created_at || data.current_period_start!,
    current_period_end: data.next_billing_date || data.current_period_end!,
    cancel_at_period_end: data.cancel_at_next_billing_date || false,
    metadata: data.metadata
  };

  if (!subscription.subscription_id || !customerId) {
    console.error(`❌ [${requestId}] Missing required subscription data for activation:`, {
      hasSubscriptionId: !!subscription.subscription_id,
      hasCustomerId: !!customerId,
      rawData: data
    });
    return;
  }

  console.log(`✅ [${requestId}] Processing subscription activation:`, {
    subscriptionId: subscription.subscription_id,
    customerId: customerId,
    status: subscription.status
  });

  try {
    // Find user by dodo_customer_id
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, subscription_tier')
      .eq('dodo_customer_id', customerId)
      .single();

    if (userError || !user) {
      console.error(`❌ [${requestId}] User not found for customer_id ${customerId}:`, userError);
      return;
    }

    console.log(`👤 [${requestId}] Found user for activation:`, user);

    // Update subscription status to active
    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        expires_at: subscription.current_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    if (subscriptionError) {
      console.error(`❌ [${requestId}] Error updating subscription to active:`, subscriptionError);
    } else {
      console.log(`✅ [${requestId}] Subscription updated to active`);
    }

    // Update user status to active/paid
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({
        is_paid: true,
        subscription_status: 'active',
        subscription_ends_at: subscription.current_period_end,
        dodo_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error(`❌ [${requestId}] Error updating user to active:`, userUpdateError);
      throw userUpdateError;
    }

    console.log(`✅ [${requestId}] User updated to active status`);

    // Track activation
    try {
      await captureEvent(user.email, 'subscription_activated', {
        subscription_id: subscription.subscription_id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        plan: user.subscription_tier,
        user_id: user.id
      });
      console.log(`✅ [${requestId}] Subscription activation tracked for user:`, user.id);
    } catch (trackingError) {
      console.error(`❌ [${requestId}] Tracking failed:`, trackingError);
    }

    console.log(`✅ [${requestId}] Subscription activated successfully:`, subscription.subscription_id);

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handleSubscriptionActive:`, error);
    throw error;
  }
}

// Placeholder functions for other webhook events
async function handleSubscriptionRenewed(data: WebhookPayload['data'], requestId: string) {
  console.log(`🔄 [${requestId}] Subscription renewed - handling similar to creation`);
  // Use same logic as subscription created
  await handleSubscriptionCreated(data, requestId);
}

async function handlePaymentSucceeded(data: WebhookPayload['data'], requestId: string) {
  console.log(`💰 [${requestId}] Payment succeeded - tracking only`);
  // Just track the event, don't modify subscription
  const customerId = data.customer?.customer_id;
  if (customerId) {
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('email, id, subscription_tier')
        .eq('dodo_customer_id', customerId)
        .single();

      if (user) {
        await captureEvent(user.email, 'payment_succeeded', {
          payment_id: data.payment_id,
          amount: data.total_amount || data.amount,
          currency: data.currency,
          subscription_id: data.subscription_id,
          plan: user.subscription_tier,
          user_id: user.id
        });
        console.log(`✅ [${requestId}] Payment success tracked for user:`, user.id);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error tracking payment:`, error);
    }
  }
}

async function handleSubscriptionCanceled(data: WebhookPayload['data'], requestId: string) {
  console.log(`❌ [${requestId}] Subscription canceled - updating to free tier`);
  
  const customerId = data.customer?.customer_id;
  if (!customerId) return;

  try {
    // Update user back to free tier
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        is_paid: false,
        subscription_status: 'canceled',
        subscription_tier: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('dodo_customer_id', customerId);

    if (userError) {
      console.error(`❌ [${requestId}] Error updating user on cancellation:`, userError);
    } else {
      console.log(`✅ [${requestId}] User updated to free tier on cancellation`);
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Error in handleSubscriptionCanceled:`, error);
  }
}

async function handlePaymentFailed(data: WebhookPayload['data'], requestId: string) {
  console.log(`💸 [${requestId}] Payment failed - tracking only`);
  // Just track the event
  const customerId = data.customer?.customer_id;
  if (customerId) {
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('email, id, subscription_tier')
        .eq('dodo_customer_id', customerId)
        .single();

      if (user) {
        await captureEvent(user.email, 'payment_failed', {
          payment_id: data.payment_id,
          amount: data.total_amount || data.amount,
          currency: data.currency,
          subscription_id: data.subscription_id,
          plan: user.subscription_tier,
          user_id: user.id
        });
        console.log(`✅ [${requestId}] Payment failure tracked for user:`, user.id);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error tracking payment failure:`, error);
    }
  }
}