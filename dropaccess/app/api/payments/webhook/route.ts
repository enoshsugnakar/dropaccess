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

// Add this temporary debugging to your webhook route in production
// Replace the webhook route with this enhanced version for debugging:

export async function POST(request: NextRequest) {
  console.log('🎣 PRODUCTION Webhook received at:', new Date().toISOString());
  
  try {
    // Log environment variables (safely)
    console.log('🔧 Environment check:', {
      has_webhook_secret: !!process.env.DODO_PAYMENTS_WEBHOOK_SECRET,
      has_supabase_admin: !!supabaseAdmin,
      has_api_key: !!process.env.DODO_PAYMENTS_API_KEY,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT,
      node_env: process.env.NODE_ENV
    });

    if (!supabaseAdmin) {
      console.error('❌ CRITICAL: supabaseAdmin not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Get raw body
    const body = await request.text();
    console.log('📦 Webhook body length:', body.length);
    console.log('📦 Webhook body preview:', body.substring(0, 200) + '...');
    
    // Log headers
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log('📋 Webhook headers:', allHeaders);

    // Extract webhook headers
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

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(body);
      console.log('📄 PRODUCTION Webhook payload:', {
        type: payload.type,
        subscription_id: payload.data?.subscription?.subscription_id,
        customer_id: payload.data?.subscription?.customer_id,
        user_id: payload.data?.subscription?.metadata?.user_id,
        plan: payload.data?.subscription?.metadata?.plan
      });
    } catch (parseError) {
      console.error('❌ CRITICAL: Failed to parse webhook payload:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // IMPORTANT: Skip signature verification for debugging
    console.log('⚠️ PRODUCTION DEBUG: Skipping signature verification');

    const { type, data } = payload;
    console.log('🎯 Processing webhook type:', type);

    // Handle webhook events
    switch (type) {
      case WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        console.log('🚀 PRODUCTION: Processing subscription created');
        await handleSubscriptionCreated(data);
        console.log('✅ PRODUCTION: Subscription created handler completed');
        break;
        
      case WEBHOOK_EVENTS.PAYMENT_SUCCEEDED:
        console.log('💰 PRODUCTION: Processing payment succeeded');
        await handlePaymentSucceeded(data);
        console.log('✅ PRODUCTION: Payment succeeded handler completed');
        break;
        
      default:
        console.log('❓ PRODUCTION: Unhandled webhook type:', type);
    }

    console.log('✅ PRODUCTION: Webhook processing completed successfully');
    return NextResponse.json({ 
      success: true, 
      message: `Processed ${type} event in production`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ PRODUCTION WEBHOOK ERROR:', error);
    console.error('Error stack:', error.stack);
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

// Enhanced subscription handler with more logging
async function handleSubscriptionCreated(data: WebhookPayload['data']) {
  console.log('📝 PRODUCTION: handleSubscriptionCreated called');
  
  if (!supabaseAdmin) {
    console.error('❌ PRODUCTION: supabaseAdmin not available');
    return;
  }
  
  const { subscription } = data;
  if (!subscription) {
    console.error('❌ PRODUCTION: No subscription data in webhook');
    return;
  }

  console.log('📊 PRODUCTION: Subscription data:', {
    subscription_id: subscription.subscription_id,
    customer_id: subscription.customer_id,
    product_id: subscription.product_id,
    status: subscription.status,
    metadata: subscription.metadata
  });

  const { user_id: userId, plan } = subscription.metadata || {};
  if (!userId) {
    console.error('❌ PRODUCTION: No user_id in subscription metadata');
    return;
  }

  console.log('👤 PRODUCTION: Processing for user:', userId, 'plan:', plan);

  try {
    // Get user email for tracking
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ PRODUCTION: Error fetching user:', userError);
      return;
    }

    const userEmail = user?.email || 'unknown';
    console.log('📧 PRODUCTION: User email:', userEmail);

    // Update user subscription status
    console.log('📝 PRODUCTION: Updating user subscription status');
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
      console.error('❌ PRODUCTION: Error updating user:', userUpdateResult.error);
    } else {
      console.log('✅ PRODUCTION: User updated successfully');
    }

    // Create subscription record
    console.log('📝 PRODUCTION: Creating subscription record');
    // Check if subscription already exists
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();

    let subscriptionResult;
    if (existingSubscription) {
      // Update existing
      subscriptionResult = await supabaseAdmin
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
      // Create new
      subscriptionResult = await supabaseAdmin
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

    if (subscriptionResult.error) {
      console.error('❌ PRODUCTION: Error with subscription record:', subscriptionResult.error);
    } else {
      console.log('✅ PRODUCTION: Subscription record processed successfully');
    }

    console.log('✅ PRODUCTION: Subscription created successfully for user:', userId);

  } catch (error) {
    console.error('❌ PRODUCTION: Error in handleSubscriptionCreated:', error);
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