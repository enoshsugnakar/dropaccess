import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import dodoClient, { PRODUCT_CONFIG, PlanType } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';

// GET endpoint to fetch subscription data
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get subscription details - look for ANY subscription, not just active ones
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Don't treat missing subscription as an error
    const hasSubscription = !subError && subscription;

    console.log('📊 Subscription check:', {
      userId,
      hasSubscription,
      subscriptionStatus: subscription?.status,
      userTier: user.subscription_tier,
      subError: subError?.code
    });

    return NextResponse.json({
      user,
      hasSubscription,
      subscription: subscription || null,
      subscription_error: subError?.code === 'PGRST116' ? null : subError
    });

  } catch (error: any) {
    console.error('Subscription GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, userId, userEmail, newPlan } = body;

    if (!action || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId, userEmail' },
        { status: 400 }
      );
    }

    // Get current subscription - look for any subscription, not just active
    const { data: currentSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('🔧 Manage API called:', {
      action,
      userId,
      hasSubscription: !!currentSubscription,
      subscriptionStatus: currentSubscription?.status,
      subscriptionPlan: currentSubscription?.plan
    });

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
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Database configuration error' },
      { status: 500 }
    );
  }

  if (!currentSubscription) {
    return NextResponse.json(
      { error: 'No subscription found. Please create a new subscription first.' },
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

  // Check if this is a fake/simulated subscription
  const isFakeSubscription = currentSubscription.dodo_subscription_id?.startsWith('real_') || 
                            currentSubscription.dodo_subscription_id?.startsWith('debug_');

  if (isFakeSubscription) {
    console.log('🎭 Detected fake subscription, updating locally only');
    
    try {
      // Update local subscription record only (no Dodo API call)
      await supabaseAdmin
        .from('subscriptions')
        .update({
          plan: newPlan,
          dodo_product_id: newPlanConfig.productId,
          price_cents: newPlanConfig.price,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id);

      // Update user tier
      await supabaseAdmin
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
        user_id: userId,
        method: 'local_simulation'
      });

      return NextResponse.json({
        success: true,
        message: `Plan changed successfully from ${currentSubscription.plan} to ${newPlan} (simulated)`,
        newPlan: newPlan,
        simulation: true,
        subscription: {
          ...currentSubscription,
          plan: newPlan,
          price_cents: newPlanConfig.price
        }
      });

    } catch (localError: any) {
      console.error('Local plan change error:', localError);
      return NextResponse.json(
        { 
          error: 'Failed to change plan locally',
          details: localError.message
        },
        { status: 500 }
      );
    }
  }

  // Real subscription - use Dodo API
  try {
    console.log('🔄 Real subscription detected, using Dodo API');
    
    // Use Dodo's change plan API with required proration_billing_mode
    const updatedSubscription = await dodoClient.subscriptions.changePlan(
      currentSubscription.dodo_subscription_id,
      {
        product_id: newPlanConfig.productId,
        quantity: 1,
        proration_billing_mode: 'prorated_immediately'
      }
    );

    // Update local subscription record (using admin client)
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        dodo_product_id: newPlanConfig.productId,
        price_cents: newPlanConfig.price,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id);

    // Update user tier (using admin client)
    await supabaseAdmin
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
      user_id: userId,
      method: 'dodo_api'
    });

    return NextResponse.json({
      success: true,
      message: 'Plan changed successfully via Dodo API',
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
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Database configuration error' },
      { status: 500 }
    );
  }

  if (!currentSubscription) {
    return NextResponse.json(
      { error: 'No subscription found to cancel' },
      { status: 404 }
    );
  }

  // Check if this is a fake/simulated subscription
  const isFakeSubscription = currentSubscription.dodo_subscription_id?.startsWith('real_') || 
                            currentSubscription.dodo_subscription_id?.startsWith('debug_');

  if (isFakeSubscription) {
    console.log('🎭 Detected fake subscription, canceling locally only');
    
    try {
      // Update local subscription record only
      await supabaseAdmin
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id);

      // Update user status immediately for simulation
      await supabaseAdmin
        .from('users')
        .update({
          is_paid: false,
          subscription_status: 'canceled',
          subscription_tier: 'free',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Track cancellation
      await captureEvent(userEmail, 'subscription_canceled', {
        plan: currentSubscription.plan,
        subscription_id: currentSubscription.dodo_subscription_id,
        cancel_at_period_end: true,
        user_id: userId,
        method: 'local_simulation'
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription canceled successfully (simulated)',
        cancelAtPeriodEnd: true,
        simulation: true
      });

    } catch (localError: any) {
      console.error('Local cancellation error:', localError);
      return NextResponse.json(
        { 
          error: 'Failed to cancel subscription locally',
          details: localError.message
        },
        { status: 500 }
      );
    }
  }

  // Real subscription - use Dodo API
  try {
    console.log('🔄 Real subscription detected, using Dodo API for cancellation');
    
    // Update subscription status to cancelled using the update method
    const canceledSubscription = await dodoClient.subscriptions.update(
      currentSubscription.dodo_subscription_id,
      {
        metadata: {
          cancelled_by_user: 'true',
          cancelled_at: new Date().toISOString()
        }
      }
    );

    // Update local subscription record (using admin client)
    await supabaseAdmin
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
      user_id: userId,
      method: 'dodo_api'
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
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Database configuration error' },
      { status: 500 }
    );
  }

  if (!currentSubscription) {
    return NextResponse.json(
      { error: 'No subscription found to reactivate' },
      { status: 404 }
    );
  }

  // Check if this is a fake/simulated subscription
  const isFakeSubscription = currentSubscription.dodo_subscription_id?.startsWith('real_') || 
                            currentSubscription.dodo_subscription_id?.startsWith('debug_');

  if (isFakeSubscription) {
    console.log('🎭 Detected fake subscription, reactivating locally only');
    
    try {
      // Update local subscription record only
      await supabaseAdmin
        .from('subscriptions')
        .update({
          cancel_at_period_end: false,
          status: 'active',
          canceled_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id);

      // Reactivate user status
      await supabaseAdmin
        .from('users')
        .update({
          is_paid: true,
          subscription_status: 'active',
          subscription_tier: currentSubscription.plan,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Track reactivation
      await captureEvent(userEmail, 'subscription_reactivated', {
        plan: currentSubscription.plan,
        subscription_id: currentSubscription.dodo_subscription_id,
        user_id: userId,
        method: 'local_simulation'
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription reactivated successfully (simulated)',
        simulation: true,
        subscription: {
          ...currentSubscription,
          status: 'active',
          cancel_at_period_end: false
        }
      });

    } catch (localError: any) {
      console.error('Local reactivation error:', localError);
      return NextResponse.json(
        { 
          error: 'Failed to reactivate subscription locally',
          details: localError.message
        },
        { status: 500 }
      );
    }
  }

  // Real subscription - use Dodo API
  try {
    console.log('🔄 Real subscription detected, using Dodo API for reactivation');
    
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

    // Update local subscription record (using admin client)
    await supabaseAdmin
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
      user_id: userId,
      method: 'dodo_api'
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