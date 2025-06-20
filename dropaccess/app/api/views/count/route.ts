// Create: app/api/views/count/route.ts

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

    // Get user's drop IDs
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
        totalViews: 0
      })
    }

    // Get drop IDs array
    const dropIds = userDrops.map(drop => drop.id)

    // Sum all access_count from drop_recipients for user's drops
    const { data: recipients, error } = await supabaseAdmin
      .from('drop_recipients')
      .select('access_count')
      .in('drop_id', dropIds)

    if (error) {
      console.error('Error fetching access counts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch access counts' },
        { status: 500 }
      )
    }

    // Sum up all access counts
    const totalViews = recipients?.reduce((sum, recipient) => {
      return sum + (recipient.access_count || 0)
    }, 0) || 0

    return NextResponse.json({
      success: true,
      totalViews
    })

  } catch (error) {
    console.error('Total views API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}