// Create: app/api/recipients/count/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    // First get the user's drop IDs
    const { data: userDrops, error: dropsError } = await supabaseAdmin
      .from('drops')
      .select('id')
      .eq('owner_id', userId)

    if (dropsError) {
      console.error('Error fetching user drops:', dropsError)
      return NextResponse.json(
        { error: 'Failed to fetch user drops' },
        { status: 500 }
      )
    }

    if (!userDrops || userDrops.length === 0) {
      return NextResponse.json({
        success: true,
        recipientCount: 0
      })
    }

    // Get drop IDs array
    const dropIds = userDrops.map(drop => drop.id)

    // Count total recipients across all user's drops
    const { count, error } = await supabaseAdmin
      .from('drop_recipients')
      .select('*', { count: 'exact', head: true })
      .in('drop_id', dropIds)

    if (error) {
      console.error('Error fetching recipient count:', error)
      return NextResponse.json(
        { error: 'Failed to fetch recipient count' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      recipientCount: count || 0
    })

  } catch (error) {
    console.error('Recipient count API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}