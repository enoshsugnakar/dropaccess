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
    // Handle flexible payload structure - sometimes data is directly in root
    subscription_id?: string;
    customer_id?: string;
    product_id?: string;
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
    payment_id?: string;
    amount?: number;
    currency?: string;
    metadata?: any;
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
      subscriptionId: payload.data?.subscription?.subscription_id,
      paymentId: payload.data?.payment?.payment_id,
      customerId: payload.data?.subscription?.customer_id || payload.data?.payment?.customer_id
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

  // Extract subscription data - handle both nested and flat structures
  const subscription = data.subscription || {
    subscription_id: data.subscription_id!,
    customer_id: data.customer_id!,
    product_id: data.product_id!,
    status: data.status!,
    current_period_start: data.current_period_start!,
    current_period_end: data.current_period_end!,
    cancel_at_period_end: false,
    metadata: data.metadata
  };

  if (!subscription.subscription_id || !subscription.customer_id) {
    console.error(`❌ [${requestId}] Missing required subscription data:`, {
      hasSubscriptionId: !!subscription.subscription_id,
      hasCustomerId: !!subscription.customer_id,
      rawData: data
    });
    return;
  }

  console.log(`📝 [${requestId}] Processing subscription created:`, {
    subscriptionId: subscription.subscription_id,
    customerId: subscription.customer_id,
    productId: subscription.product_id,
    status: subscription.status,
    metadata: subscription.metadata
  });

  const { user_id: userId, plan, is_plan_change } = subscription.metadata || {};
  
  if (!userId) {
    console.error(`❌ [${requestId}] No user_id in subscription metadata:`, subscription.metadata);
    return;
  }

  try {
    // Fetch user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, subscription_tier, is_paid')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error(`❌ [${requestId}] Error fetching user:`, userError);
      return;
    }

    const userEmail = user.email;
    const isUpgrade = is_plan_change === 'true';
    
    console.log(`👤 [${requestId}] User details:`, { 
      userId, 
      userEmail, 
      currentTier: user.subscription_tier,
      newPlan: plan,
      isUpgrade 
    });

    // Update user subscription status
    const userUpdateData = {
      is_paid: true,
      subscription_status: 'active',
      subscription_tier: plan || 'individual',
      subscription_ends_at: subscription.current_period_end,
      dodo_customer_id: subscription.customer_id,
      updated_at: new Date().toISOString()
    };

    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update(userUpdateData)
      .eq('id', userId);

    if (userUpdateError) {
      console.error(`❌ [${requestId}] Error updating user:`, userUpdateError);
      throw userUpdateError;
    }

    console.log(`✅ [${requestId}] User updated successfully`);

    // Handle subscription record - upsert pattern
    const subscriptionData = {
      user_id: userId,
      plan: plan || 'individual',
      status: 'active',
      dodo_customer_id: subscription.customer_id,
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
      throw subscriptionResult.error;
    }

    console.log(`✅ [${requestId}] Subscription record processed successfully`);

    // Track the event
    const eventName = isUpgrade ? 'subscription_upgraded' : 'subscription_created';
    await captureEvent(userEmail, eventName, {
      plan: plan || 'individual',
      subscription_id: subscription.subscription_id,
      customer_id: subscription.customer_id,
      current_period_end: subscription.current_period_end,
      user_id: userId,
      is_upgrade: isUpgrade,
      previous_tier: user.subscription_tier
    });

    console.log(`✅ [${requestId}] Subscription ${eventName} completed for user:`, userId);

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handleSubscriptionCreated:`, error);
    throw error;
  }
}

async function handleSubscriptionActive(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handleSubscriptionActive`);
    return;
  }

  // Extract subscription data - handle both nested and flat structures
  const subscription = data.subscription || {
    subscription_id: data.subscription_id!,
    customer_id: data.customer_id!,
    product_id: data.product_id!,
    status: data.status!,
    current_period_start: data.current_period_start!,
    current_period_end: data.current_period_end!,
    cancel_at_period_end: false,
    metadata: data.metadata
  };

  if (!subscription.subscription_id || !subscription.customer_id) {
    console.error(`❌ [${requestId}] Missing required subscription data for activation:`, {
      hasSubscriptionId: !!subscription.subscription_id,
      hasCustomerId: !!subscription.customer_id,
      rawData: data
    });
    return;
  }

  console.log(`✅ [${requestId}] Processing subscription activation:`, {
    subscriptionId: subscription.subscription_id,
    customerId: subscription.customer_id,
    status: subscription.status
  });

  try {
    // subscription.active typically means the subscription is now active after payment
    // This is similar to subscription.created but for existing subscriptions that became active
    
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
      throw subscriptionError;
    }

    // Update user status to active/paid
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        is_paid: true,
        subscription_status: 'active',
        subscription_ends_at: subscription.current_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('dodo_customer_id', subscription.customer_id);

    if (userError) {
      console.error(`❌ [${requestId}] Error updating user to active:`, userError);
      throw userError;
    }

    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id, subscription_tier')
      .eq('dodo_customer_id', subscription.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'subscription_activated', {
        subscription_id: subscription.subscription_id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        plan: user.subscription_tier,
        user_id: user.id
      });
      
      console.log(`✅ [${requestId}] Subscription activation tracked for user:`, user.id);
    }

    console.log(`✅ [${requestId}] Subscription activated successfully:`, subscription.subscription_id);

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handleSubscriptionActive:`, error);
    throw error;
  }
}

async function handleSubscriptionRenewed(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handleSubscriptionRenewed`);
    return;
  }

  // Extract subscription data - handle both nested and flat structures
  const subscription = data.subscription || {
    subscription_id: data.subscription_id!,
    customer_id: data.customer_id!,
    product_id: data.product_id!,
    status: data.status!,
    current_period_start: data.current_period_start!,
    current_period_end: data.current_period_end!,
    cancel_at_period_end: false,
    metadata: data.metadata
  };

  if (!subscription.subscription_id || !subscription.customer_id) {
    console.error(`❌ [${requestId}] Missing required subscription data for renewal:`, {
      hasSubscriptionId: !!subscription.subscription_id,
      hasCustomerId: !!subscription.customer_id,
      rawData: data
    });
    return;
  }

  console.log(`🔄 [${requestId}] Processing subscription renewal:`, subscription.subscription_id);

  try {
    // Update subscription record
    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        expires_at: subscription.current_period_end,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    if (subscriptionError) {
      console.error(`❌ [${requestId}] Error updating subscription:`, subscriptionError);
      throw subscriptionError;
    }

    // Update user subscription end date
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        subscription_ends_at: subscription.current_period_end,
        subscription_status: 'active',
        is_paid: true,
        updated_at: new Date().toISOString()
      })
      .eq('dodo_customer_id', subscription.customer_id);

    if (userError) {
      console.error(`❌ [${requestId}] Error updating user on renewal:`, userError);
      throw userError;
    }

    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id, subscription_tier')
      .eq('dodo_customer_id', subscription.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'subscription_renewed', {
        subscription_id: subscription.subscription_id,
        current_period_end: subscription.current_period_end,
        plan: user.subscription_tier,
        user_id: user.id
      });
    }

    console.log(`✅ [${requestId}] Subscription renewed successfully:`, subscription.subscription_id);

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handleSubscriptionRenewed:`, error);
    throw error;
  }
}

async function handlePaymentSucceeded(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handlePaymentSucceeded`);
    return;
  }

  // Extract payment data - handle both nested and flat structures
  const payment = data.payment || {
    payment_id: data.payment_id!,
    customer_id: data.customer_id!,
    amount: data.amount!,
    currency: data.currency || 'USD',
    status: data.status || 'succeeded',
    subscription_id: data.subscription_id,
    metadata: data.metadata
  };

  if (!payment.payment_id || !payment.customer_id) {
    console.error(`❌ [${requestId}] Missing required payment data:`, {
      hasPaymentId: !!payment.payment_id,
      hasCustomerId: !!payment.customer_id,
      rawData: data
    });
    return;
  }

  console.log(`💰 [${requestId}] Processing payment success:`, {
    paymentId: payment.payment_id,
    amount: payment.amount,
    currency: payment.currency,
    subscriptionId: payment.subscription_id
  });

  try {
    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id, subscription_tier')
      .eq('dodo_customer_id', payment.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'payment_succeeded', {
        payment_id: payment.payment_id,
        amount: payment.amount,
        currency: payment.currency,
        subscription_id: payment.subscription_id,
        plan: user.subscription_tier,
        user_id: user.id
      });
      
      console.log(`✅ [${requestId}] Payment success tracked for user:`, user.id);
    } else {
      console.warn(`⚠️ [${requestId}] User not found for payment tracking`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handlePaymentSucceeded:`, error);
    throw error;
  }
}

async function handleSubscriptionCanceled(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handleSubscriptionCanceled`);
    return;
  }

  const { subscription } = data;
  if (!subscription) {
    console.error(`❌ [${requestId}] No subscription data for cancellation`);
    return;
  }

  console.log(`❌ [${requestId}] Processing subscription cancellation:`, {
    subscriptionId: subscription.subscription_id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at
  });

  try {
    // Update subscription status
    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: subscription.canceled_at || new Date().toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    if (subscriptionError) {
      console.error(`❌ [${requestId}] Error updating subscription:`, subscriptionError);
      throw subscriptionError;
    }

    // If canceled immediately (not at period end), update user status
    if (!subscription.cancel_at_period_end) {
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({
          is_paid: false,
          subscription_status: 'canceled',
          subscription_tier: 'free',
          updated_at: new Date().toISOString()
        })
        .eq('dodo_customer_id', subscription.customer_id);

      if (userError) {
        console.error(`❌ [${requestId}] Error updating user on cancellation:`, userError);
        throw userError;
      }
    }

    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id, subscription_tier')
      .eq('dodo_customer_id', subscription.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'subscription_canceled', {
        subscription_id: subscription.subscription_id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
        immediate_cancellation: !subscription.cancel_at_period_end,
        user_id: user.id
      });
    }

    console.log(`✅ [${requestId}] Subscription cancellation processed:`, subscription.subscription_id);

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handleSubscriptionCanceled:`, error);
    throw error;
  }
}

async function handlePaymentFailed(data: WebhookPayload['data'], requestId: string) {
  if (!supabaseAdmin) {
    console.error(`❌ [${requestId}] supabaseAdmin not available in handlePaymentFailed`);
    return;
  }

  const { payment } = data;
  if (!payment) {
    console.error(`❌ [${requestId}] No payment data for failure`);
    return;
  }

  console.log(`💸 [${requestId}] Processing payment failure:`, {
    paymentId: payment.payment_id,
    amount: payment.amount,
    subscriptionId: payment.subscription_id
  });

  try {
    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id, subscription_tier')
      .eq('dodo_customer_id', payment.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'payment_failed', {
        payment_id: payment.payment_id,
        amount: payment.amount,
        currency: payment.currency,
        subscription_id: payment.subscription_id,
        plan: user.subscription_tier,
        user_id: user.id
      });
      
      console.log(`✅ [${requestId}] Payment failure tracked for user:`, user.id);
    } else {
      console.warn(`⚠️ [${requestId}] User not found for payment failure tracking`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error in handlePaymentFailed:`, error);
    throw error;
  }
}