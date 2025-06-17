// app/api/subscription/limits/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { checkDropCreationLimits, canAccessFeature } from '@/lib/subscription-limits'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action') // 'check_drop' or 'check_feature'
    const feature = searchParams.get('feature') // for feature access checks
    const recipientCount = parseInt(searchParams.get('recipientCount') || '0')
    const fileSizeMb = parseFloat(searchParams.get('fileSizeMb') || '0')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'check_drop':
        const dropLimits = await checkDropCreationLimits(userId, recipientCount, fileSizeMb)
        return NextResponse.json({
          success: true,
          limits: dropLimits,
          canProceed: Object.values(dropLimits).every(check => check.allowed)
        })

      case 'check_feature':
        if (!feature) {
          return NextResponse.json(
            { error: 'Missing feature parameter for feature check' },
            { status: 400 }
          )
        }

        if (!['analytics', 'export', 'branding'].includes(feature)) {
          return NextResponse.json(
            { error: 'Invalid feature parameter' },
            { status: 400 }
          )
        }

        const featureAccess = await canAccessFeature(userId, feature as 'analytics' | 'export' | 'branding')
        return NextResponse.json({
          success: true,
          hasAccess: featureAccess.allowed,
          reason: featureAccess.reason,
          upgradePrompt: featureAccess.upgradePrompt
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Subscription limits API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
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
    const { userId, action, recipientCount = 0, fileSizeMb = 0, feature } = body

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, action' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'validate_drop_creation':
        // Comprehensive validation before drop creation
        const validationResult = await checkDropCreationLimits(userId, recipientCount, fileSizeMb)
        
        const canProceed = Object.values(validationResult).every(check => check.allowed)
        const blockingIssues = Object.entries(validationResult)
          .filter(([_, check]) => !check.allowed)
          .map(([key, check]) => ({
            type: key,
            reason: check.reason,
            upgradePrompt: check.upgradePrompt
          }))

        return NextResponse.json({
          success: true,
          canProceed,
          blockingIssues,
          limits: validationResult,
          timestamp: new Date().toISOString()
        })

      case 'check_bulk_operation':
        // For bulk operations (business feature)
        const { itemCount } = body
        
        if (!itemCount || itemCount < 1) {
          return NextResponse.json(
            { error: 'Invalid itemCount for bulk operation' },
            { status: 400 }
          )
        }

        // Check if user has business plan for bulk operations
        const bulkAccess = await canAccessFeature(userId, 'analytics') // Using analytics as proxy for paid features
        if (!bulkAccess.allowed && itemCount > 5) {
          return NextResponse.json({
            success: true,
            canProceed: false,
            reason: 'Bulk operations require Business plan',
            upgradePrompt: {
              type: 'hard',
              title: 'Bulk Operations Available',
              description: 'Manage multiple drops at once with the Business plan',
              suggestedPlan: 'business',
              ctaText: 'Upgrade to Business'
            }
          })
        }

        return NextResponse.json({
          success: true,
          canProceed: true,
          maxBulkSize: bulkAccess.allowed ? -1 : 5 // Unlimited for business, 5 for others
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Subscription limits POST API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper route for getting user's current tier and limits
export async function OPTIONS(request: NextRequest) {
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

    // Get user's tier and subscription status
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_tier, subscription_status, is_paid')
      .eq('id', userId)
      .single()

    if (userError) {
      return NextResponse.json(
        { error: 'User not found', details: userError.message },
        { status: 404 }
      )
    }

    // Get current usage from usage tracking
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'month')
      .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .single()

    // Return user tier info and current usage
    return NextResponse.json({
      success: true,
      user: {
        tier: user.subscription_tier || 'free',
        status: user.subscription_status || 'free',
        isPaid: user.is_paid || false
      },
      usage: usage ? {
        drops_created: usage.drops_created || 0,
        recipients_added: usage.recipients_added || 0,
        storage_used_mb: parseFloat(usage.storage_used_mb || '0')
      } : {
        drops_created: 0,
        recipients_added: 0,
        storage_used_mb: 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Subscription info API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}