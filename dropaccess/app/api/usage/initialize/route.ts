// CREATE: app/api/usage/initialize/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(request: NextRequest) {
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

    console.log('Initializing usage data for user:', userId)

    // Calculate current month and week periods
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Count actual drops created this month for accurate initialization
    const { count: monthlyDrops, error: monthlyDropsError } = await supabaseAdmin
      .from('drops')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())

    if (monthlyDropsError) {
      console.error('Error counting monthly drops:', monthlyDropsError)
    }

    // Count actual drops created this week
    const { count: weeklyDrops, error: weeklyDropsError } = await supabaseAdmin
      .from('drops')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .gte('created_at', startOfWeek.toISOString())
      .lte('created_at', endOfWeek.toISOString())

    if (weeklyDropsError) {
      console.error('Error counting weekly drops:', weeklyDropsError)
    }

    // Count actual recipients added this month
    const { count: monthlyRecipients, error: monthlyRecipientsError } = await supabaseAdmin
      .from('drop_recipients')
      .select('*, drops!inner(*)', { count: 'exact', head: true })
      .eq('drops.owner_id', userId)
      .gte('drops.created_at', startOfMonth.toISOString())
      .lte('drops.created_at', endOfMonth.toISOString())

    if (monthlyRecipientsError) {
      console.error('Error counting monthly recipients:', monthlyRecipientsError)
    }

    // Count actual recipients added this week
    const { count: weeklyRecipients, error: weeklyRecipientsError } = await supabaseAdmin
      .from('drop_recipients')
      .select('*, drops!inner(*)', { count: 'exact', head: true })
      .eq('drops.owner_id', userId)
      .gte('drops.created_at', startOfWeek.toISOString())
      .lte('drops.created_at', endOfWeek.toISOString())

    if (weeklyRecipientsError) {
      console.error('Error counting weekly recipients:', weeklyRecipientsError)
    }

    // Upsert monthly usage record
    const { error: monthlyUpsertError } = await supabaseAdmin
      .from('usage_tracking')
      .upsert({
        user_id: userId,
        period_type: 'month',
        period_start: startOfMonth.toISOString(),
        period_end: endOfMonth.toISOString(),
        drops_created: monthlyDrops || 0,
        recipients_added: monthlyRecipients || 0,
        storage_used_mb: 0, // You can enhance this later if needed
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id,period_type,period_start'
      })

    if (monthlyUpsertError) {
      console.error('Error upserting monthly usage:', monthlyUpsertError)
    }

    // Upsert weekly usage record
    const { error: weeklyUpsertError } = await supabaseAdmin
      .from('usage_tracking')
      .upsert({
        user_id: userId,
        period_type: 'week',
        period_start: startOfWeek.toISOString(),
        period_end: endOfWeek.toISOString(),
        drops_created: weeklyDrops || 0,
        recipients_added: weeklyRecipients || 0,
        storage_used_mb: 0, // You can enhance this later if needed
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id,period_type,period_start'
      })

    if (weeklyUpsertError) {
      console.error('Error upserting weekly usage:', weeklyUpsertError)
    }

    return NextResponse.json({
      success: true,
      message: 'Usage data initialized successfully',
      data: {
        monthly: {
          drops_created: monthlyDrops || 0,
          recipients_added: monthlyRecipients || 0,
          storage_used_mb: 0
        },
        weekly: {
          drops_created: weeklyDrops || 0,
          recipients_added: weeklyRecipients || 0,
          storage_used_mb: 0
        }
      }
    })

  } catch (error) {
    console.error('Usage initialization error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}