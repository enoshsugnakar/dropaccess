import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import dodoClient, { PRODUCT_CONFIG, PlanType } from '@/lib/dodoClient';
import { captureEvent } from '@/lib/posthog';

export async function POST(request: NextRequest) {
  console.log('🚀 Payment creation started');
  
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { plan, userId, userEmail } = body;

    console.log('📝 Payment request:', { plan, userId, userEmail });

    // Validate request
    if (!plan || !userId || !userEmail) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: plan, userId, userEmail' },
        { status: 400 }
      );
    }

    // Validate plan type
    if (!PRODUCT_CONFIG[plan as PlanType]) {
      console.error('❌ Invalid plan type:', plan);
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "individual" or "business"' },
        { status: 400 }
      );
    }

    const planConfig = PRODUCT_CONFIG[plan as PlanType];
    console.log('📦 Plan config:', planConfig);

    // Check environment variables
    const configCheck = {
      hasApiKey: !!process.env.DODO_PAYMENTS_API_KEY,
      hasProductId: !!planConfig.productId,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL
    };

    console.log('🔧 Config check:', configCheck);

    if (!configCheck.hasApiKey) {
      console.error('❌ DODO_PAYMENTS_API_KEY not set');
      return NextResponse.json(
        { error: 'Payment service not configured - missing API key' },
        { status: 500 }
      );
    }

    if (!configCheck.hasProductId) {
      console.error('❌ Product ID not set for plan:', plan);
      return NextResponse.json(
        { error: `Product configuration missing for ${plan} plan` },
        { status: 500 }
      );
    }

    if (!configCheck.hasAppUrl) {
      console.error('❌ NEXT_PUBLIC_APP_URL not set');
      return NextResponse.json(
        { error: 'App URL not configured' },
        { status: 500 }
      );
    }

    // Check if user exists (using admin client to bypass RLS)
    console.log('👤 Checking user exists:', userId);
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', { id: user.id, email: user.email, tier: user.subscription_tier });

    // Check for existing subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      console.log('🔄 Existing subscription found:', existingSubscription.plan);
      
      // Check if they're trying to subscribe to the same plan
      if (existingSubscription.plan === plan) {
        return NextResponse.json(
          { error: `You already have an active ${plan} subscription` },
          { status: 409 }
        );
      }

      console.log(`🔄 Plan change detected: ${existingSubscription.plan} → ${plan}`);
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
        console.log('🆕 Creating new Dodo customer');
        
        // Create new customer in Dodo
        const customerResponse = await dodoClient.customers.create({
          email: userEmail,
          name: userEmail.split('@')[0] // Use email prefix as name fallback
        });

        dodoCustomerId = customerResponse.customer_id;
        console.log('✅ Dodo customer created:', dodoCustomerId);

        // Update user with Dodo customer ID (using admin client)
        await supabaseAdmin
          .from('users')
          .update({ dodo_customer_id: dodoCustomerId })
          .eq('id', userId);
      } else {
        console.log('♻️ Using existing Dodo customer:', dodoCustomerId);
      }

      console.log('💳 Creating subscription payment link...');

      // Create subscription payment link
      const subscription = await dodoClient.subscriptions.create({
        billing: {
          city: 'Unknown',
          country: 'IN', // Default to India
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

      console.log('✅ Payment link created:', {
        subscriptionId: subscription.subscription_id,
        paymentLink: subscription.payment_link
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
      console.error('❌ Dodo Payments error:', dodoError);
      console.error('❌ Error details:', {
        message: dodoError.message,
        status: dodoError.status,
        response: dodoError.response?.data
      });

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
          details: dodoError.message || 'Payment service error',
          debug: {
            hasApiKey: !!process.env.DODO_PAYMENTS_API_KEY,
            productId: planConfig.productId,
            environment: process.env.DODO_PAYMENTS_ENVIRONMENT
          }
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Payment creation error:', error);

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}