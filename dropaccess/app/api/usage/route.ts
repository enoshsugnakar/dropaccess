// REPLACE: app/api/usage/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { TIER_LIMITS } from '@/lib/usageTracking'  // Fixed import

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

    // Standardized period calculations
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())

    // Get monthly usage - more flexible query
    const { data: monthlyUsage, error: monthlyError } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'month')
      .gte('period_start', startOfMonth.toISOString())
      .lte('period_start', now.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (monthlyError && monthlyError.code !== 'PGRST116') {
      console.error('Error fetching monthly usage:', monthlyError)
    }

    // Get weekly usage - more flexible query
    const { data: weeklyUsage, error: weeklyError } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'week')
      .gte('period_start', startOfWeek.toISOString())
      .lte('period_start', now.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (weeklyError && weeklyError.code !== 'PGRST116') {
      console.error('Error fetching weekly usage:', weeklyError)
    }

    // Get user's subscription info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_tier, subscription_status')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user:', userError)
      return NextResponse.json(
        { error: 'User not found', details: userError.message },
        { status: 404 }
      )
    }

    // Get the correct limits for the user's tier - FIXED
    const userTier = user.subscription_tier || 'free'
    const currentLimits = TIER_LIMITS[userTier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free

    // If no usage records exist, create them
    if (!monthlyUsage) {
      console.log('Creating initial monthly usage record for user:', userId)
      await createInitialUsageRecord(userId, 'month', startOfMonth)
    }

    if (!weeklyUsage) {
      console.log('Creating initial weekly usage record for user:', userId)
      await createInitialUsageRecord(userId, 'week', startOfWeek)
    }

    // Return response with proper field mapping
    return NextResponse.json({
      monthly: {
        drops_created: monthlyUsage?.drops_created || 0,
        recipients_added: monthlyUsage?.recipients_added || 0,
        storage_used_mb: parseFloat(monthlyUsage?.storage_used_mb || '0'),
        period_start: monthlyUsage?.period_start || startOfMonth.toISOString(),
        period_end: monthlyUsage?.period_end || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
      },
      weekly: {
        drops_created: weeklyUsage?.drops_created || 0,
        recipients_added: weeklyUsage?.recipients_added || 0,
        storage_used_mb: parseFloat(weeklyUsage?.storage_used_mb || '0'),
        period_start: weeklyUsage?.period_start || startOfWeek.toISOString(),
        period_end: weeklyUsage?.period_end || new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      limits: {
        drops: currentLimits.drops_per_month,
        recipients: currentLimits.recipients_per_drop,
        storage: currentLimits.storage_total_mb,
        file_size_mb: currentLimits.file_size_mb
      },
      subscription: {
        tier: user.subscription_tier || 'free',
        status: user.subscription_status || 'free'
      }
    })

  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// Helper function to create initial usage records
async function createInitialUsageRecord(userId: string, periodType: 'month' | 'week', periodStart: Date) {
  if (!supabaseAdmin) return

  try {
    let periodEnd: Date
    
    if (periodType === 'month') {
      periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)
    } else {
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    }

    const { error } = await supabaseAdmin
      .from('usage_tracking')
      .insert({
        user_id: userId,
        period_type: periodType,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        drops_created: 0,
        recipients_added: 0,
        storage_used_mb: 0
      })

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Error creating initial usage record:', error)
    }
  } catch (error) {
    console.error('Error in createInitialUsageRecord:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { userId, action, amount = 1 } = body

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, action' },
        { status: 400 }
      )
    }

    // Validate action
    const validActions = ['drop_created', 'recipient_added', 'storage_used']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: ' + validActions.join(', ') },
        { status: 400 }
      )
    }

    await updateUsageTracking(userId, action, amount)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Usage tracking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function updateUsageTracking(userId: string, action: string, amount: number) {
  if (!supabaseAdmin) throw new Error('Admin client not available')

  const now = new Date()
  
  // Update monthly tracking
  await updatePeriodUsage(userId, 'month', now, action, amount)
  
  // Update weekly tracking
  await updatePeriodUsage(userId, 'week', now, action, amount)
}

async function updatePeriodUsage(
  userId: string, 
  periodType: 'month' | 'week', 
  now: Date, 
  action: string, 
  amount: number
) {
  if (!supabaseAdmin) throw new Error('Admin client not available')

  // Calculate period boundaries - STANDARDIZED
  let periodStart: Date, periodEnd: Date

  if (periodType === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else {
    periodStart = new Date(now)
    periodStart.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  // Try to get existing record with more flexible query
  const { data: existing } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('period_type', periodType)
    .gte('period_start', periodStart.toISOString())
    .lte('period_start', periodEnd.toISOString())
    .limit(1)
    .maybeSingle()

  const updateField = action === 'drop_created' ? 'drops_created' :
                    action === 'recipient_added' ? 'recipients_added' :
                    'storage_used_mb'

  if (existing) {
    // Update existing record
    const updates: any = { updated_at: now.toISOString() }
    updates[updateField] = existing[updateField] + amount

    await supabaseAdmin
      .from('usage_tracking')
      .update(updates)
      .eq('id', existing.id)
  } else {
    // Create new record
    const newRecord: any = {
      user_id: userId,
      period_type: periodType,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      drops_created: 0,
      recipients_added: 0,
      storage_used_mb: 0
    }
    newRecord[updateField] = amount

    await supabaseAdmin
      .from('usage_tracking')
      .insert(newRecord)
  }
}