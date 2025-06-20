// REPLACE: lib/usageTracking.ts

import { supabaseAdmin } from '@/lib/supabaseClient';

// Subscription tier limits
export const TIER_LIMITS = {
  free: {
    drops_per_month: 3,
    recipients_per_drop: 3,
    file_size_mb: 10,
    storage_total_mb: 30, // 3 drops × 10MB
    analytics: 'basic',
    custom_branding: false,
    export_data: false
  },
  individual: {
    drops_per_month: 15,
    recipients_per_drop: 20,
    file_size_mb: 300,
    storage_total_mb: 4500, // 15 drops × 300MB
    analytics: 'advanced',
    custom_branding: false,
    export_data: true
  },
  business: {
    drops_per_month: -1, // Unlimited
    recipients_per_drop: -1, // Unlimited
    file_size_mb: -1, // Unlimited
    storage_total_mb: -1, // Unlimited
    analytics: 'premium',
    custom_branding: true,
    export_data: true
  }
} as const;

export type TierType = keyof typeof TIER_LIMITS;

// Get current month period - STANDARDIZED
export function getCurrentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return {
    period_start: start.toISOString(),
    period_end: end.toISOString()
  };
}

// Get user's current usage for the month - FIXED
export async function getCurrentUsage(userId: string) {
  if (!supabaseAdmin) {
    console.warn('⚠️ supabaseAdmin not configured, using fallback usage data');
    return {
      id: 'mock-id',
      user_id: userId,
      period_type: 'month',
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
      drops_created: 1,
      recipients_added: 2,
      storage_used_mb: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    // Get or create usage tracking record for current month - IMPROVED QUERY
    let { data: usage, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'month')
      .gte('period_start', periodStart.toISOString())
      .lte('period_start', now.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!usage) {
      // No record found, create one
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const { data: newUsage, error: createError } = await supabaseAdmin
        .from('usage_tracking')
        .insert({
          user_id: userId,
          period_type: 'month',
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          drops_created: 0,
          recipients_added: 0,
          storage_used_mb: 0
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      usage = newUsage;
    }

    return usage;
  } catch (error) {
    console.error('Error getting current usage:', error);
    throw error;
  }
}

// Update usage after creating a drop - SIMPLIFIED
export async function updateUsageAfterDrop(
  userId: string, 
  recipientCount: number, 
  fileSizeMb: number = 0
) {
  if (!supabaseAdmin) {
    console.warn('Supabase admin client not configured, skipping usage update');
    return true;
  }

  try {
    // Use the standardized update function
    const now = new Date();
    
    // Update monthly tracking
    await updatePeriodUsage(userId, 'month', now, 'drop_created', 1);
    await updatePeriodUsage(userId, 'month', now, 'recipient_added', recipientCount);
    if (fileSizeMb > 0) {
      await updatePeriodUsage(userId, 'month', now, 'storage_used', fileSizeMb);
    }
    
    // Update weekly tracking
    await updatePeriodUsage(userId, 'week', now, 'drop_created', 1);
    await updatePeriodUsage(userId, 'week', now, 'recipient_added', recipientCount);
    if (fileSizeMb > 0) {
      await updatePeriodUsage(userId, 'week', now, 'storage_used', fileSizeMb);
    }

    return true;
  } catch (error) {
    console.error('Error updating usage after drop:', error);
    throw error;
  }
}

// STANDARDIZED period update function
async function updatePeriodUsage(
  userId: string, 
  periodType: 'month' | 'week', 
  now: Date, 
  action: string, 
  amount: number
) {
  if (!supabaseAdmin) throw new Error('Admin client not available')

  // Calculate period boundaries - SAME AS API
  let periodStart: Date, periodEnd: Date

  if (periodType === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else {
    periodStart = new Date(now)
    periodStart.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  // Try to get existing record with flexible query
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
    updates[updateField] = (existing[updateField] || 0) + amount

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

// Check if user can create a drop based on their tier limits
export async function canCreateDrop(userId: string, recipientCount: number, fileSizeMb: number = 0) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  try {
    const usage = await getCurrentUsage(userId);
    
    // Get user's tier
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const tier = (user.subscription_tier || 'free') as TierType;
    const limits = TIER_LIMITS[tier];

    // Check drop limit
    if (limits.drops_per_month !== -1 && usage.drops_created >= limits.drops_per_month) {
      return {
        allowed: false,
        reason: `Monthly drop limit reached (${usage.drops_created}/${limits.drops_per_month})`
      };
    }

    // Check recipient limit
    if (limits.recipients_per_drop !== -1 && recipientCount > limits.recipients_per_drop) {
      return {
        allowed: false,
        reason: `Too many recipients (${recipientCount}/${limits.recipients_per_drop} allowed)`
      };
    }

    // Check file size limit
    if (limits.file_size_mb !== -1 && fileSizeMb > limits.file_size_mb) {
      return {
        allowed: false,
        reason: `File too large (${fileSizeMb}MB/${limits.file_size_mb}MB allowed)`
      };
    }

    // Check storage limit
    const totalStorageAfter = usage.storage_used_mb + fileSizeMb;
    if (limits.storage_total_mb !== -1 && totalStorageAfter > limits.storage_total_mb) {
      return {
        allowed: false,
        reason: `Storage limit exceeded (${Math.round(totalStorageAfter)}MB/${limits.storage_total_mb}MB available)`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking drop creation limits:', error);
    throw error;
  }
}

// Get comprehensive usage summary for a user
export async function getUsageSummary(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  try {
    const usage = await getCurrentUsage(userId);
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('subscription_tier, subscription_status')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const tier = (user.subscription_tier || 'free') as TierType;
    const limits = TIER_LIMITS[tier];

    const percentages = {
      drops: limits.drops_per_month === -1 ? 0 : (usage.drops_created / limits.drops_per_month) * 100,
      storage: limits.storage_total_mb === -1 ? 0 : (usage.storage_used_mb / limits.storage_total_mb) * 100
    };

    return {
      tier,
      limits,
      current: usage,
      percentages,
      subscriptionStatus: user.subscription_status
    };
  } catch (error) {
    console.error('Error getting usage summary:', error);
    throw error;
  }
}

// Reset usage for new billing period (called by webhook)
export async function resetUsageForNewPeriod(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  const { period_start, period_end } = getCurrentMonthPeriod();

  try {
    // Create new usage record for the new period
    const { error } = await supabaseAdmin
      .from('usage_tracking')
      .insert({
        user_id: userId,
        period_type: 'month',
        period_start,
        period_end,
        drops_created: 0,
        recipients_added: 0,
        storage_used_mb: 0
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error resetting usage for new period:', error);
    throw error;
  }
}

// Utility to format file size
export function formatFileSize(sizeInMb: number): string {
  if (sizeInMb >= 1024) {
    return `${(sizeInMb / 1024).toFixed(1)} GB`;
  }
  return `${sizeInMb.toFixed(1)} MB`;
}

// Utility to format usage percentage
export function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600';
  if (percentage >= 75) return 'text-orange-600';
  if (percentage >= 50) return 'text-yellow-600';
  return 'text-green-600';
}