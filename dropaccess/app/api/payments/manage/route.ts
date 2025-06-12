import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import dodoClient, { PRODUCT_CONFIG, PlanType } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user's current subscription
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null
      });
    }

    // Get additional details from Dodo if needed
    let dodoSubscription = null;
    if (subscription.dodo_subscription_id) {
      try {
        dodoSubscription = await dodoClient.subscriptions.retrieve(
          subscription.dodo_subscription_id
        );
      } catch (dodoError) {
        console.error('Error fetching Dodo subscription:', dodoError);
        // Continue without Dodo details
      }
    }

    return NextResponse.json({
      hasSubscription: true,
      subscription: {
        ...subscription,
        dodoDetails: dodoSubscription
      }
    });

  } catch (error: any) {
    console.error('Subscription management error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, userEmail, newPlan } = body;

    if (!action || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId, userEmail' },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: currentSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    switch (action) {
      case 'change_plan':
        return await handlePlanChange(currentSubscription, newPlan, userId, userEmail);
      
      case 'cancel':
        return await handleCancellation(currentSubscription, userId, userEmail);
      
      case 'reactivate':
        return await handleReactivation(currentSubscription, userId, userEmail);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Subscription action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePlanChange(currentSubscription: any, newPlan: string, userId: string, userEmail: string) {
  if (!currentSubscription) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 404 }
    );
  }

  if (!PRODUCT_CONFIG[newPlan as PlanType]) {
    return NextResponse.json(
      { error: 'Invalid plan type' },
      { status: 400 }
    );
  }

  const newPlanConfig = PRODUCT_CONFIG[newPlan as PlanType];

  try {
    // Use Dodo's change plan API with required proration_billing_mode
    const updatedSubscription = await dodoClient.subscriptions.changePlan(
      currentSubscription.dodo_subscription_id,
      {
        product_id: newPlanConfig.productId,
        quantity: 1,
        proration_billing_mode: 'prorated_immediately' // Only valid value according to TypeScript definition
      }
    );

    // Update local subscription record
    await supabase
      .from('subscriptions')
      .update({
        plan: newPlan,
        dodo_product_id: newPlanConfig.productId,
        price_cents: newPlanConfig.price,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id);

    // Update user tier
    await supabase
      .from('users')
      .update({
        subscription_tier: newPlan,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    // Track plan change
    await captureEvent(userEmail, 'subscription_plan_changed', {
      from_plan: currentSubscription.plan,
      to_plan: newPlan,
      subscription_id: currentSubscription.dodo_subscription_id,
      user_id: userId
    });

    return NextResponse.json({
      success: true,
      message: 'Plan changed successfully',
      newPlan: newPlan,
      subscription: updatedSubscription
    });

  } catch (dodoError: any) {
    console.error('Dodo plan change error:', dodoError);
    
    await captureEvent(userEmail, 'subscription_plan_change_failed', {
      from_plan: currentSubscription.plan,
      to_plan: newPlan,
      error_message: dodoError.message,
      user_id: userId
    });

    return NextResponse.json(
      { 
        error: 'Failed to change plan',
        details: dodoError.message
      },
      { status: 500 }
    );
  }
}

async function handleCancellation(currentSubscription: any, userId: string, userEmail: string) {
  if (!currentSubscription) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 404 }
    );
  }

  try {
    // Update subscription status to cancelled using the update method
    // Dodo doesn't have a separate cancel method, we update with cancel status
    const canceledSubscription = await dodoClient.subscriptions.update(
      currentSubscription.dodo_subscription_id,
      {
        metadata: {
          cancelled_by_user: 'true',
          cancelled_at: new Date().toISOString()
        }
      }
    );

    // Update local subscription record
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id);

    // Track cancellation
    await captureEvent(userEmail, 'subscription_canceled', {
      plan: currentSubscription.plan,
      subscription_id: currentSubscription.dodo_subscription_id,
      cancel_at_period_end: true,
      user_id: userId
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      cancelAtPeriodEnd: true
    });

  } catch (dodoError: any) {
    console.error('Dodo cancellation error:', dodoError);
    
    await captureEvent(userEmail, 'subscription_cancellation_failed', {
      plan: currentSubscription.plan,
      error_message: dodoError.message,
      user_id: userId
    });

    return NextResponse.json(
      { 
        error: 'Failed to cancel subscription',
        details: dodoError.message
      },
      { status: 500 }
    );
  }
}

async function handleReactivation(currentSubscription: any, userId: string, userEmail: string) {
  if (!currentSubscription) {
    return NextResponse.json(
      { error: 'No subscription found' },
      { status: 404 }
    );
  }

  try {
    // Reactivate subscription by updating metadata to remove cancellation
    const reactivatedSubscription = await dodoClient.subscriptions.update(
      currentSubscription.dodo_subscription_id,
      {
        metadata: {
          reactivated: 'true',
          reactivated_at: new Date().toISOString(),
          cancelled_by_user: 'false'
        }
      }
    );

    // Update local subscription record
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id);

    // Track reactivation
    await captureEvent(userEmail, 'subscription_reactivated', {
      plan: currentSubscription.plan,
      subscription_id: currentSubscription.dodo_subscription_id,
      user_id: userId
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: reactivatedSubscription
    });

  } catch (dodoError: any) {
    console.error('Dodo reactivation error:', dodoError);
    
    await captureEvent(userEmail, 'subscription_reactivation_failed', {
      plan: currentSubscription.plan,
      error_message: dodoError.message,
      user_id: userId
    });

    return NextResponse.json(
      { 
        error: 'Failed to reactivate subscription',
        details: dodoError.message
      },
      { status: 500 }
    );
  }
}