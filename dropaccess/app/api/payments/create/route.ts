import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import dodoClient, { PRODUCT_CONFIG, PlanType } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';

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
    const { plan, userId, userEmail } = body;

    // Validate request
    if (!plan || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: plan, userId, userEmail' },
        { status: 400 }
      );
    }

    // Validate plan type
    if (!PRODUCT_CONFIG[plan as PlanType]) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "individual" or "business"' },
        { status: 400 }
      );
    }

    const planConfig = PRODUCT_CONFIG[plan as PlanType];

    // Check if user exists (using admin client to bypass RLS)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check for existing subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    // If user has existing subscription, handle plan change
    if (existingSubscription) {
      // Check if they're trying to subscribe to the same plan
      if (existingSubscription.plan === plan) {
        return NextResponse.json(
          { error: `You already have an active ${plan} subscription` },
          { status: 409 }
        );
      }

      console.log(`🔄 User ${userId} wants to change from ${existingSubscription.plan} to ${plan}`);

      // For plan changes, use the subscription management API
      try {
        const planChangeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payments/manage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'change_plan',
            userId,
            userEmail,
            newPlan: plan
          })
        });

        const planChangeResult = await planChangeResponse.json();

        if (planChangeResponse.ok) {
          // Track plan change initiation
          await captureEvent(userEmail, 'plan_change_initiated', {
            from_plan: existingSubscription.plan,
            to_plan: plan,
            user_id: userId,
            method: 'direct_change'
          });

          return NextResponse.json({
            success: true,
            message: `Plan changed successfully from ${existingSubscription.plan} to ${plan}`,
            plan_change: true,
            from_plan: existingSubscription.plan,
            to_plan: plan,
            subscription: planChangeResult.subscription
          });
        } else {
          // If direct plan change fails, fall back to cancel and recreate
          console.warn('⚠️ Direct plan change failed, falling back to cancel and recreate');
          
          // Cancel current subscription
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payments/manage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'cancel',
              userId,
              userEmail
            })
          });

          // Continue to create new subscription below
          console.log('🔄 Creating new subscription after cancellation');
        }
      } catch (planChangeError) {
        console.error('❌ Plan change failed:', planChangeError);
        // Continue to create new subscription as fallback
      }
    }

    // Track payment initiation
    await captureEvent(userEmail, 'payment_link_requested', {
      plan,
      product_id: planConfig.productId,
      price_cents: planConfig.price,
      user_id: userId,
      is_plan_change: !!existingSubscription
    });

    try {
      // Create or get Dodo customer
      let dodoCustomerId = user.dodo_customer_id;
      
      if (!dodoCustomerId) {
        // Create new customer in Dodo
        const customerResponse = await dodoClient.customers.create({
          email: userEmail,
          name: userEmail.split('@')[0] // Use email prefix as name fallback
        });

        dodoCustomerId = customerResponse.customer_id;

        // Update user with Dodo customer ID (using admin client)
        await supabaseAdmin
          .from('users')
          .update({ dodo_customer_id: dodoCustomerId })
          .eq('id', userId);
      }

      // Create subscription payment link
      const subscription = await dodoClient.subscriptions.create({
        billing: {
          city: 'Unknown',
          country: 'IN', // Default to India, can be updated later
          state: 'Unknown',
          street: 'Unknown',
          zipcode: '000000'
        },
        customer: {
          customer_id: dodoCustomerId
        },
        product_id: planConfig.productId,
        payment_link: true,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
        quantity: 1,
        metadata: {
          user_id: userId,
          plan: plan,
          app_name: 'DropAccess',
          is_plan_change: existingSubscription ? 'true' : 'false',
          previous_plan: existingSubscription?.plan || 'none'
        }
      });

      // Track successful payment link creation
      await captureEvent(userEmail, 'payment_link_created', {
        plan,
        subscription_id: subscription.subscription_id,
        payment_link: subscription.payment_link,
        dodo_customer_id: dodoCustomerId,
        user_id: userId,
        is_plan_change: !!existingSubscription,
        previous_plan: existingSubscription?.plan
      });

      return NextResponse.json({
        success: true,
        payment_link: subscription.payment_link,
        subscription_id: subscription.subscription_id,
        plan: plan,
        amount: planConfig.price,
        is_plan_change: !!existingSubscription,
        message: existingSubscription 
          ? `Creating payment link to change from ${existingSubscription.plan} to ${plan}` 
          : `Creating payment link for ${plan} subscription`
      });

    } catch (dodoError: any) {
      console.error('Dodo Payments error:', dodoError);

      // Track Dodo API error
      await captureEvent(userEmail, 'payment_link_creation_failed', {
        plan,
        error_message: dodoError.message || 'Unknown Dodo error',
        error_type: 'dodo_api_error',
        user_id: userId,
        is_plan_change: !!existingSubscription
      });

      return NextResponse.json(
        { 
          error: 'Failed to create payment link',
          details: dodoError.message || 'Payment service error'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Payment creation error:', error);

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}