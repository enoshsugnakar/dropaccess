import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import dodoClient from '@/lib/dodoClient'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    const { userId, returnUrl } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Get user's Dodo customer ID
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('dodo_customer_id, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.dodo_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please complete a payment first.' },
        { status: 404 }
      )
    }

    try {
      // Create customer portal session using correct DodoPayments API
      const customerPortalSession = await dodoClient.customers.customerPortal.create(
        user.dodo_customer_id
      )

      return NextResponse.json({
        portal_url: customerPortalSession.link,
        success: true
      })

    } catch (dodoError: any) {
      console.error('Dodo customer portal creation failed:', dodoError)
      
      return NextResponse.json(
        { 
          error: 'Failed to create billing portal session',
          details: dodoError.message || 'Unknown error from DodoPayments'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Billing portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}