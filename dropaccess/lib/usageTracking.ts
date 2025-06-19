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

// Get current month period
export function getCurrentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return {
    period_start: start.toISOString(),
    period_end: end.toISOString()
  };
}

// Get user's current usage for the month
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
    };}

  const { period_start, period_end } = getCurrentMonthPeriod();

  try {
    // Get or create usage tracking record for current month
    let { data: usage, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'month')
      .eq('period_start', period_start)
      .single();

    if (error && error.code === 'PGRST116') {
      // No record found, create one
      const { data: newUsage, error: createError } = await supabaseAdmin
        .from('usage_tracking')
        .insert({
          user_id: userId,
          period_type: 'month',
          period_start,
          period_end,
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
    } else if (error) {
      throw error;
    }

    return usage;
  } catch (error) {
    console.error('Error getting current usage:', error);
    throw error;
  }
}

// Update usage after creating a drop
export async function updateUsageAfterDrop(
  userId: string, 
  recipientCount: number, 
  fileSizeMb: number = 0
) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
    return true;
  }

  try {
    const usage = await getCurrentUsage(userId);

    const { error } = await supabaseAdmin
      .from('usage_tracking')
      .update({
        drops_created: usage.drops_created + 1,
        recipients_added: usage.recipients_added + recipientCount,
        storage_used_mb: usage.storage_used_mb + fileSizeMb,
        updated_at: new Date().toISOString()
      })
      .eq('id', usage.id);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error updating usage after drop:', error);
    throw error;
  }
}

// Check if user can create a drop based on their tier limits
export async function canCreateDrop(userId: string, recipientCount: number, fileSizeMb: number = 0) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  try {
    // Get user's tier
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    const tier = (user.subscription_tier || 'free') as TierType;
    const limits = TIER_LIMITS[tier];

    // Get current usage
    const usage = await getCurrentUsage(userId);

    // Check limits
    const checks = {
      canCreateDrop: limits.drops_per_month === -1 || usage.drops_created < limits.drops_per_month,
      canAddRecipients: limits.recipients_per_drop === -1 || recipientCount <= limits.recipients_per_drop,
      canUploadFile: limits.file_size_mb === -1 || fileSizeMb <= limits.file_size_mb,
      hasStorageSpace: limits.storage_total_mb === -1 || (usage.storage_used_mb + fileSizeMb) <= limits.storage_total_mb
    };

    const canProceed = Object.values(checks).every(check => check);

    return {
      canProceed,
      checks,
      currentUsage: usage,
      limits,
      tier
    };
  } catch (error) {
    console.error('Error checking drop creation limits:', error);
    throw error;
  }
}

// Get usage summary for dashboard
export async function getUsageSummary(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  try {
    // Get user's tier
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_tier, subscription_status')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    const tier = (user.subscription_tier || 'free') as TierType;
    const limits = TIER_LIMITS[tier];

    // Get current usage
    const usage = await getCurrentUsage(userId);

    // Calculate percentages
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

    if (error) {
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