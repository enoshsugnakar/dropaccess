import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { WEBHOOK_EVENTS } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';
import { Webhook } from 'standardwebhooks';

// Initialize webhook verifier
const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_SECRET!);

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
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('Webhook error: supabaseAdmin not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Get raw body for webhook verification
    const body = await request.text();
    
    // Extract webhook headers
    const webhookHeaders: WebhookHeaders = {
      'webhook-id': request.headers.get('webhook-id') || '',
      'webhook-signature': request.headers.get('webhook-signature') || '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') || ''
    };

    // Verify webhook signature
    try {
      const verifiedPayload = await webhook.verify(body, webhookHeaders);
      console.log('Webhook verified successfully');
    } catch (verificationError) {
      console.error('Webhook verification failed:', verificationError);
      return NextResponse.json(
        { error: 'Webhook verification failed' },
        { status: 401 }
      );
    }

    // Parse the verified payload
    const payload: WebhookPayload = JSON.parse(body);
    const { type, data } = payload;

    console.log('Processing webhook:', type, data);

    // Handle different webhook events
    switch (type) {
      case WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        await handleSubscriptionCreated(data);
        break;
        
      case WEBHOOK_EVENTS.SUBSCRIPTION_RENEWED:
        await handleSubscriptionRenewed(data);
        break;
        
      case WEBHOOK_EVENTS.PAYMENT_SUCCEEDED:
        await handlePaymentSucceeded(data);
        break;
        
      case WEBHOOK_EVENTS.SUBSCRIPTION_CANCELED:
        await handleSubscriptionCanceled(data);
        break;
        
      case WEBHOOK_EVENTS.PAYMENT_FAILED:
        await handlePaymentFailed(data);
        break;
        
      default:
        console.log('Unhandled webhook type:', type);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { subscription } = data;
  if (!subscription) return;

  const { user_id: userId, plan } = subscription.metadata || {};
  if (!userId) {
    console.error('No user_id in subscription metadata');
    return;
  }

  try {
    // Get user email for tracking
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = user?.email || 'unknown';

    // Update user subscription status
    await supabaseAdmin
      .from('users')
      .update({
        is_paid: true,
        subscription_status: 'active',
        subscription_tier: plan || 'individual',
        subscription_ends_at: subscription.current_period_end,
        dodo_customer_id: subscription.customer_id
      })
      .eq('id', userId);

    // Create or update subscription record
    await supabaseAdmin
      .from('subscriptions')
      .upsert({
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
        expires_at: subscription.current_period_end
      });

    // Track subscription creation
    await captureEvent(userEmail, 'subscription_created', {
      plan: plan || 'individual',
      subscription_id: subscription.subscription_id,
      customer_id: subscription.customer_id,
      current_period_end: subscription.current_period_end,
      user_id: userId
    });

    console.log('Subscription created successfully for user:', userId);

  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleSubscriptionRenewed(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { subscription } = data;
  if (!subscription) return;

  try {
    // Update subscription record
    await supabaseAdmin
      .from('subscriptions')
      .update({
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        expires_at: subscription.current_period_end,
        status: 'active'
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    // Update user subscription end date
    await supabaseAdmin
      .from('users')
      .update({
        subscription_ends_at: subscription.current_period_end,
        subscription_status: 'active'
      })
      .eq('dodo_customer_id', subscription.customer_id);

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

    console.log('Subscription renewed successfully:', subscription.subscription_id);

  } catch (error) {
    console.error('Error handling subscription renewed:', error);
  }
}

async function handlePaymentSucceeded(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { payment } = data;
  if (!payment) return;

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

    console.log('Payment succeeded:', payment.payment_id);

  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handleSubscriptionCanceled(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { subscription } = data;
  if (!subscription) return;

  try {
    // Update subscription status
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: subscription.canceled_at || new Date().toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('dodo_subscription_id', subscription.subscription_id);

    // If canceled immediately, update user status
    if (!subscription.cancel_at_period_end) {
      await supabaseAdmin
        .from('users')
        .update({
          is_paid: false,
          subscription_status: 'canceled',
          subscription_tier: 'free'
        })
        .eq('dodo_customer_id', subscription.customer_id);
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

    console.log('Subscription canceled:', subscription.subscription_id);

  } catch (error) {
    console.error('Error handling subscription canceled:', error);
  }
}

async function handlePaymentFailed(data: WebhookPayload['data']) {
  if (!supabaseAdmin) return;
  
  const { payment } = data;
  if (!payment) return;

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

    console.log('Payment failed:', payment.payment_id);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}