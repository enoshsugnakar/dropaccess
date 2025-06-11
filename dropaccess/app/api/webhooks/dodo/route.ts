import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { paymentService } from '@/lib/services/payment-service';
import { supabase } from '@/lib/supabaseClient';
import { DODO_CONFIG } from '@/lib/payments/dodo-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = headers().get('dodo-signature');

    // Verify webhook signature (implement based on DodoPayments docs)
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event.data);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.data);
        break;

      case 'payment.succeeded':
        await handlePaymentSucceeded(event.data);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.data);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  // Implement signature verification based on DodoPayments documentation
  // This is a placeholder - replace with actual verification logic
  return true;
}

async function handleSubscriptionCreated(subscription: any) {
  // Find user by dodo_customer_id
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('dodo_customer_id', subscription.customer_id)
    .single();

  if (user) {
    await paymentService.updateUserSubscriptionStatus(
      user.id,
      subscription.plan_id,
      subscription.status
    );
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      updated_at: new Date(),
    })
    .eq('dodo_subscription_id', subscription.id);
}

async function handleSubscriptionCanceled(subscription: any) {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('dodo_customer_id', subscription.customer_id)
    .single();

  if (user) {
    await paymentService.updateUserSubscriptionStatus(
      user.id,
      'free',
      'canceled'
    );
  }
}

async function handlePaymentSucceeded(payment: any) {
  // Log successful payment
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id, id')
    .eq('dodo_subscription_id', payment.subscription_id)
    .single();

  if (subscription) {
    await paymentService.logPaymentTransaction(
      subscription.user_id,
      subscription.id,
      payment.id,
      payment.amount,
      'succeeded'
    );
  }
}

async function handlePaymentFailed(payment: any) {
  // Handle failed payment - maybe send email, update status
  console.log('Payment failed:', payment);
  
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id, id')
    .eq('dodo_subscription_id', payment.subscription_id)
    .single();

  if (subscription) {
    await paymentService.logPaymentTransaction(
      subscription.user_id,
      subscription.id,
      payment.id,
      payment.amount,
      'failed'
    );
  }
}