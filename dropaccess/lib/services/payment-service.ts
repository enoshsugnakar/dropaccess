import { supabase } from '@/lib/supabaseClient';
import { dodoPayments } from '@/lib/payments/dodo-client';
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@/lib/payments/dodo-config';

export class PaymentService {
  async createCustomerAndSubscription(
    userId: string, 
    email: string, 
    plan: SubscriptionPlan,
    paymentMethodId?: string
  ) {
    try {
      // 1. Create customer in DodoPayments
      const customer = await dodoPayments.createCustomer(email);
      
      // 2. Update user with customer ID
      await supabase
        .from('users')
        .update({ dodo_customer_id: customer.id })
        .eq('id', userId);

      // 3. Create subscription in DodoPayments
      const subscription = await dodoPayments.createSubscription(
        customer.id,
        plan, // This should be the plan ID from DodoPayments
        paymentMethodId
      );

      // 4. Create subscription record in our database
      const { data: dbSubscription, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan,
          status: subscription.status,
          dodo_customer_id: customer.id,
          dodo_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
        })
        .select()
        .single();

      if (error) throw error;

      // 5. Update user subscription status
      await this.updateUserSubscriptionStatus(userId, plan, subscription.status);

      return { customer, subscription: dbSubscription };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  async updateUserSubscriptionStatus(userId: string, plan: string, status: string) {
    const isPaid = status === 'active';
    
    return supabase
      .from('users')
      .update({
        is_paid: isPaid,
        subscription_status: status,
        subscription_tier: plan,
        subscription_ends_at: isPaid ? null : new Date(),
      })
      .eq('id', userId);
  }

  async cancelSubscription(userId: string, cancelAtPeriodEnd = true) {
    try {
      // Get current subscription
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error || !subscription) {
        throw new Error('No active subscription found');
      }

      // Cancel in DodoPayments
      const canceledSubscription = await dodoPayments.cancelSubscription(
        subscription.dodo_subscription_id,
        cancelAtPeriodEnd
      );

      // Update our database
      await supabase
        .from('subscriptions')
        .update({
          status: canceledSubscription.status,
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date(),
        })
        .eq('id', subscription.id);

      // Update user status if immediate cancellation
      if (!cancelAtPeriodEnd) {
        await this.updateUserSubscriptionStatus(userId, 'free', 'canceled');
      }

      return canceledSubscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return { data, error };
  }

  async logPaymentTransaction(
    userId: string,
    subscriptionId: string,
    dodoPaymentId: string,
    amount: number,
    status: string,
    type: 'subscription' | 'one_time' | 'refund' = 'subscription'
  ) {
    return supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        dodo_payment_id: dodoPaymentId,
        amount_cents: amount,
        status,
        transaction_type: type,
      });
  }
}

export const paymentService = new PaymentService();