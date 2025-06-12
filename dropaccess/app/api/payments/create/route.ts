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

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 409 }
      );
    }

    // Track payment initiation
    await captureEvent(userEmail, 'payment_link_requested', {
      plan,
      product_id: planConfig.productId,
      price_cents: planConfig.price,
      user_id: userId
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
          app_name: 'DropAccess'
        }
      });

      // Track successful payment link creation
      await captureEvent(userEmail, 'payment_link_created', {
        plan,
        subscription_id: subscription.subscription_id,
        payment_link: subscription.payment_link,
        dodo_customer_id: dodoCustomerId,
        user_id: userId
      });

      return NextResponse.json({
        success: true,
        payment_link: subscription.payment_link,
        subscription_id: subscription.subscription_id,
        plan: plan,
        amount: planConfig.price
      });

    } catch (dodoError: any) {
      console.error('Dodo Payments error:', dodoError);

      // Track Dodo API error
      await captureEvent(userEmail, 'payment_link_creation_failed', {
        plan,
        error_message: dodoError.message || 'Unknown Dodo error',
        error_type: 'dodo_api_error',
        user_id: userId
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