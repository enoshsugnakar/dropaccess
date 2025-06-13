import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { WEBHOOK_EVENTS } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';
import { Webhook } from 'standardwebhooks';

// Initialize webhook verifier with better error handling
let webhook: Webhook | null = null;
try {
  if (process.env.DODO_PAYMENTS_WEBHOOK_SECRET) {
    webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_SECRET);
  }
} catch (error) {
  console.error('Failed to initialize webhook verifier:', error);
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
      };
    };
    payment?: {
      payment_id: string;
      customer_id: string;
      amount: number;
      currency: string;
      status: string;
      subscription_id?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  console.log('🎣 Webhook received at:', new Date().toISOString());
  
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('❌ Webhook error: supabaseAdmin not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Get raw body for webhook verification
    const body = await request.text();
    console.log('📦 Raw webhook body length:', body.length);
    
    // Log all headers for debugging
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log('📋 All webhook headers:', allHeaders);

    // Extract webhook headers with multiple possible formats
    const webhookHeaders: WebhookHeaders = {
      'webhook-id': request.headers.get('webhook-id') || 
                   request.headers.get('svix-id') || 
                   request.headers.get('x-webhook-id') || '',
      'webhook-signature': request.headers.get('webhook-signature') || 
                          request.headers.get('svix-signature') || 
                          request.headers.get('x-webhook-signature') || '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') || 
                          request.headers.get('svix-timestamp') || 
                          request.headers.get('x-webhook-timestamp') || ''
    };

    console.log('🔑 Extracted webhook headers:', webhookHeaders);

    // Parse payload first to see what we're dealing with
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(body);
      console.log('📄 Parsed webhook payload:', {
        type: payload.type,
        dataKeys: Object.keys(payload.data || {}),
        subscriptionId: payload.data?.subscription?.subscription_id,
        paymentId: payload.data?.payment?.payment_id
      });
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Verify webhook signature if webhook verifier is available and headers exist
    if (webhook && webhookHeaders['webhook-signature']) {
      try {
        await webhook.verify(body, webhookHeaders);
        console.log('✅ Webhook signature verified successfully');
      } catch (verificationError) {
        console.error('❌ Webhook verification failed:', verificationError);
        // In test mode, log but don't fail - allows testing with fake signatures
        if (process.env.DODO_PAYMENTS_ENVIRONMENT === 'test_mode' || process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Continuing without verification in test/development mode');
        } else {
          return NextResponse.json(
            { error: 'Webhook verification failed' },
            { status: 401 }
          );
        }
      }
    } else {
      console.warn('⚠️ Webhook verification skipped - missing verifier or headers');
    }

    const { type, data } = payload;

    // Handle different webhook events
    switch (type) {
      case WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        console.log('🚀 Processing subscription created');
        await handleSubscriptionCreated(data);
        break;
        
      case WEBHOOK_EVENTS.SUBSCRIPTION_RENEWED:
        console.log('🔄 Processing subscription renewed');
        await handleSubscriptionRenewed(data);
        break;
        
      case WEBHOOK_EVENTS.PAYMENT_SUCCEEDED:
        console.log('💰 Processing payment succeeded');
        await handlePaymentSucceeded(data);
        break;
        
      case WEBHOOK_EVENTS.SUBSCRIPTION_CANCELED:
        console.log('❌ Processing subscription canceled');
        await handleSubscriptionCanceled(data);
        break;
        
      case WEBHOOK_EVENTS.PAYMENT_FAILED:
        console.log('💸 Processing payment failed');
        await handlePaymentFailed(data);
        break;
        
      default:
        console.log('❓ Unhandled webhook type:', type);
        // Still return success for unknown events
    }

    console.log('✅ Webhook processed successfully');
    return NextResponse.json({ 
      success: true, 
      message: `Processed ${type} event`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(data: WebhookPayload['data']) {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not available in handleSubscriptionCreated');
    return;
  }
  
  const { subscription } = data;
  if (!subscription) {
    console.error('❌ No subscription data in webhook');
    return;
  }

  console.log('📝 Processing subscription created:', {
    subscriptionId: subscription.subscription_id,
    customerId: subscription.customer_id,
    metadata: subscription.metadata
  });

  const { user_id: userId, plan } = subscription.metadata || {};
  if (!userId) {
    console.error('❌ No user_id in subscription metadata:', subscription.metadata);
    return;
  }

  try {
    // Get user email for tracking
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, subscription_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return;
    }

    const userEmail = user?.email || 'unknown';
    console.log('👤 Found user:', { userId, userEmail, currentTier: user?.subscription_tier });

    // Update user subscription status
    const userUpdateResult = await supabaseAdmin
      .from('users')
      .update({
        is_paid: true,
        subscription_status: 'active',
        subscription_tier: plan || 'individual',
        subscription_ends_at: subscription.current_period_end,
        dodo_customer_id: subscription.customer_id
      })
      .eq('id', userId);

    if (userUpdateResult.error) {
      console.error('❌ Error updating user:', userUpdateResult.error);
    } else {
      console.log('✅ User updated successfully');
    }

    // Check if subscription already exists
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();

    let subscriptionUpsertResult;
    
    if (existingSubscription) {
      // Update existing subscription
      subscriptionUpsertResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          plan: plan || 'individual',
          status: 'active',
          dodo_customer_id: subscription.customer_id,
          dodo_subscription_id: subscription.subscription_id,
          dodo_product_id: subscription.product_id,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          billing_interval: 'monthly',
          expires_at: subscription.current_period_end,
          price_cents: plan === 'business' ? 1999 : 999,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Create new subscription
      subscriptionUpsertResult = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan: plan || 'individual',
          status: 'active',
          dodo_customer_id: subscription.customer_id,
          dodo_subscription_id: subscription.subscription_id,
          dodo_product_id: subscription.product_id,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          billing_interval: 'monthly',
          started_at: new Date().toISOString(),
          expires_at: subscription.current_period_end,
          price_cents: plan === 'business' ? 1999 : 999
        });
    }

    if (subscriptionUpsertResult.error) {
      console.error('❌ Error upserting subscription:', subscriptionUpsertResult.error);
    } else {
      console.log('✅ Subscription record created/updated successfully');
    }

    // Track subscription creation
    await captureEvent(userEmail, 'subscription_created', {
      plan: plan || 'individual',
      subscription_id: subscription.subscription_id,
      customer_id: subscription.customer_id,
      current_period_end: subscription.current_period_end,
      user_id: userId
    });

    console.log('✅ Subscription created successfully for user:', userId);

  } catch (error) {
    console.error('❌ Error handling subscription created:', error);
  }
}

async function handleSubscriptionRenewed(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { subscription } = data;
  if (!subscription) return;

  console.log('🔄 Processing subscription renewal:', subscription.subscription_id);

  try {
    // Update subscription record
    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        expires_at: subscription.current_period_end,
        status: 'active'
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    if (subscriptionUpdateResult.error) {
      console.error('❌ Error updating subscription on renewal:', subscriptionUpdateResult.error);
    }

    // Update user subscription end date
    const userUpdateResult = await supabaseAdmin
      .from('users')
      .update({
        subscription_ends_at: subscription.current_period_end,
        subscription_status: 'active'
      })
      .eq('dodo_customer_id', subscription.customer_id);

    if (userUpdateResult.error) {
      console.error('❌ Error updating user on renewal:', userUpdateResult.error);
    }

    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id')
      .eq('dodo_customer_id', subscription.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'subscription_renewed', {
        subscription_id: subscription.subscription_id,
        current_period_end: subscription.current_period_end,
        user_id: user.id
      });
    }

    console.log('✅ Subscription renewed successfully:', subscription.subscription_id);

  } catch (error) {
    console.error('❌ Error handling subscription renewed:', error);
  }
}

async function handlePaymentSucceeded(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { payment } = data;
  if (!payment) return;

  console.log('💰 Processing payment success:', payment.payment_id);

  try {
    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id')
      .eq('dodo_customer_id', payment.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'payment_succeeded', {
        payment_id: payment.payment_id,
        amount: payment.amount,
        currency: payment.currency,
        subscription_id: payment.subscription_id,
        user_id: user.id
      });
    }

    console.log('✅ Payment succeeded tracking completed:', payment.payment_id);

  } catch (error) {
    console.error('❌ Error handling payment succeeded:', error);
  }
}

async function handleSubscriptionCanceled(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { subscription } = data;
  if (!subscription) return;

  console.log('❌ Processing subscription cancellation:', subscription.subscription_id);

  try {
    // Update subscription status
    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: subscription.canceled_at || new Date().toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    if (subscriptionUpdateResult.error) {
      console.error('❌ Error updating subscription on cancellation:', subscriptionUpdateResult.error);
    }

    // If canceled immediately, update user status
    if (!subscription.cancel_at_period_end) {
      const userUpdateResult = await supabaseAdmin
        .from('users')
        .update({
          is_paid: false,
          subscription_status: 'canceled',
          subscription_tier: 'free'
        })
        .eq('dodo_customer_id', subscription.customer_id);

      if (userUpdateResult.error) {
        console.error('❌ Error updating user on immediate cancellation:', userUpdateResult.error);
      }
    }

    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id')
      .eq('dodo_customer_id', subscription.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'subscription_canceled', {
        subscription_id: subscription.subscription_id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
        user_id: user.id
      });
    }

    console.log('✅ Subscription cancellation processed:', subscription.subscription_id);

  } catch (error) {
    console.error('❌ Error handling subscription canceled:', error);
  }
}

async function handlePaymentFailed(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { payment } = data;
  if (!payment) return;

  console.log('💸 Processing payment failure:', payment.payment_id);

  try {
    // Get user for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, id')
      .eq('dodo_customer_id', payment.customer_id)
      .single();

    if (user) {
      await captureEvent(user.email, 'payment_failed', {
        payment_id: payment.payment_id,
        amount: payment.amount,
        currency: payment.currency,
        subscription_id: payment.subscription_id,
        user_id: user.id
      });
    }

    console.log('✅ Payment failure tracking completed:', payment.payment_id);

  } catch (error) {
    console.error('❌ Error handling payment failed:', error);
  }
}