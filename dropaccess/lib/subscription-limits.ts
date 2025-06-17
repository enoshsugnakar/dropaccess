// lib/subscription-limits.ts
import { supabaseAdmin } from '@/lib/supabaseClient';
import { TIER_LIMITS, TierType, getCurrentUsage } from '@/lib/usageTracking';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradePrompt?: {
    type: 'soft' | 'hard';
    title: string;
    description: string;
    suggestedPlan: 'individual' | 'business';
    ctaText: string;
  };
}

export interface DropCreationLimits {
  canCreateDrop: LimitCheckResult;
  canAddRecipients: LimitCheckResult;
  canUploadFile: LimitCheckResult;
  hasStorageSpace: LimitCheckResult;
}

// Core enforcement functions
export class SubscriptionGuard {
  static async checkDropCreationLimits(
    userId: string,
    recipientCount: number,
    fileSizeMb: number = 0
  ): Promise<DropCreationLimits> {
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

      if (userError) throw userError;

      const tier = (user.subscription_tier || 'free') as TierType;
      const limits = TIER_LIMITS[tier];
      const usage = await getCurrentUsage(userId);

      return {
        canCreateDrop: this.checkDropLimit(tier, usage.drops_created, limits.drops_per_month),
        canAddRecipients: this.checkRecipientLimit(tier, recipientCount, limits.recipients_per_drop),
        canUploadFile: this.checkFileSizeLimit(tier, fileSizeMb, limits.file_size_mb),
        hasStorageSpace: this.checkStorageLimit(tier, usage.storage_used_mb, fileSizeMb, limits.storage_total_mb)
      };
    } catch (error) {
      console.error('Error checking subscription limits:', error);
      throw error;
    }
  }

  private static checkDropLimit(tier: TierType, currentDrops: number, limit: number): LimitCheckResult {
    if (limit === -1) return { allowed: true }; // Unlimited

    const remaining = limit - currentDrops;
    
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `You've reached your monthly limit of ${limit} drops`,
        upgradePrompt: {
          type: 'hard',
          title: 'Drop Limit Reached',
          description: `You've used all ${limit} drops for this month. Upgrade to create more drops.`,
          suggestedPlan: tier === 'free' ? 'individual' : 'business',
          ctaText: tier === 'free' ? 'Upgrade to Individual' : 'Upgrade to Business'
        }
      };
    }

    // Soft warning at 80%
    if (remaining <= Math.ceil(limit * 0.2)) {
      return {
        allowed: true,
        upgradePrompt: {
          type: 'soft',
          title: 'Almost at your limit',
          description: `You have ${remaining} drops remaining this month. Consider upgrading for more capacity.`,
          suggestedPlan: tier === 'free' ? 'individual' : 'business',
          ctaText: 'View Plans'
        }
      };
    }

    return { allowed: true };
  }

  private static checkRecipientLimit(tier: TierType, recipientCount: number, limit: number): LimitCheckResult {
    if (limit === -1) return { allowed: true }; // Unlimited

    if (recipientCount > limit) {
      return {
        allowed: false,
        reason: `Too many recipients. Your plan allows up to ${limit} recipients per drop`,
        upgradePrompt: {
          type: 'hard',
          title: 'Recipient Limit Exceeded',
          description: `You're trying to add ${recipientCount} recipients, but your plan allows only ${limit}.`,
          suggestedPlan: tier === 'free' ? 'individual' : 'business',
          ctaText: tier === 'free' ? 'Upgrade for 20 Recipients' : 'Upgrade for Unlimited'
        }
      };
    }

    return { allowed: true };
  }

  private static checkFileSizeLimit(tier: TierType, fileSizeMb: number, limit: number): LimitCheckResult {
    if (limit === -1) return { allowed: true }; // Unlimited

    if (fileSizeMb > limit) {
      return {
        allowed: false,
        reason: `File too large. Your plan allows files up to ${limit}MB`,
        upgradePrompt: {
          type: 'hard',
          title: 'File Size Limit Exceeded',
          description: `This ${Math.round(fileSizeMb)}MB file exceeds your ${limit}MB limit.`,
          suggestedPlan: tier === 'free' ? 'individual' : 'business',
          ctaText: tier === 'free' ? 'Upgrade for 300MB Files' : 'Upgrade for Unlimited'
        }
      };
    }

    return { allowed: true };
  }

  private static checkStorageLimit(tier: TierType, currentStorageMb: number, newFileMb: number, limit: number): LimitCheckResult {
    if (limit === -1) return { allowed: true }; // Unlimited

    const totalAfterUpload = currentStorageMb + newFileMb;
    
    if (totalAfterUpload > limit) {
      const availableSpace = limit - currentStorageMb;
      return {
        allowed: false,
        reason: `Not enough storage space. You have ${Math.round(availableSpace)}MB available`,
        upgradePrompt: {
          type: 'hard',
          title: 'Storage Limit Exceeded',
          description: `This upload would exceed your ${limit}MB storage limit. You have ${Math.round(availableSpace)}MB remaining.`,
          suggestedPlan: tier === 'free' ? 'individual' : 'business',
          ctaText: tier === 'free' ? 'Get 4.5GB Storage' : 'Get Unlimited Storage'
        }
      };
    }

    // Soft warning at 80% storage usage
    const storageUsagePercent = (totalAfterUpload / limit) * 100;
    if (storageUsagePercent >= 80) {
      return {
        allowed: true,
        upgradePrompt: {
          type: 'soft',
          title: 'Storage Almost Full',
          description: `You're using ${Math.round(storageUsagePercent)}% of your storage. Consider upgrading for more space.`,
          suggestedPlan: tier === 'free' ? 'individual' : 'business',
          ctaText: 'Upgrade Storage'
        }
      };
    }

    return { allowed: true };
  }

  // Feature access checks
  static async canAccessFeature(userId: string, feature: 'analytics' | 'export' | 'branding'): Promise<LimitCheckResult> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    try {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const tier = (user.subscription_tier || 'free') as TierType;
      const limits = TIER_LIMITS[tier];

      switch (feature) {
        case 'analytics':
          if (limits.analytics === 'basic' && tier === 'free') {
            return {
              allowed: false,
              reason: 'Advanced analytics requires a paid plan',
              upgradePrompt: {
                type: 'hard',
                title: 'Unlock Advanced Analytics',
                description: 'Get detailed insights, access patterns, and export capabilities with a paid plan.',
                suggestedPlan: 'individual',
                ctaText: 'Upgrade for Analytics'
              }
            };
          }
          return { allowed: true };

        case 'export':
          if (!limits.export_data) {
            return {
              allowed: false,
              reason: 'Data export requires a paid plan',
              upgradePrompt: {
                type: 'hard',
                title: 'Export Your Data',
                description: 'Export your analytics and drop data with Individual or Business plans.',
                suggestedPlan: 'individual',
                ctaText: 'Upgrade to Export'
              }
            };
          }
          return { allowed: true };

        case 'branding':
          if (!limits.custom_branding) {
            return {
              allowed: false,
              reason: 'Custom branding requires Business plan',
              upgradePrompt: {
                type: 'hard',
                title: 'Custom Branding Available',
                description: 'Remove DropAccess branding and add your own with the Business plan.',
                suggestedPlan: 'business',
                ctaText: 'Upgrade to Business'
              }
            };
          }
          return { allowed: true };

        default:
          return { allowed: true };
      }
    } catch (error) {
      console.error('Error checking feature access:', error);
      throw error;
    }
  }

  // Utility function to get upgrade suggestions
  static getUpgradeSuggestion(currentTier: TierType, context: 'drops' | 'recipients' | 'file_size' | 'storage'): {
    suggestedPlan: 'individual' | 'business';
    benefits: string[];
    pricing: string;
  } {
    const suggestions = {
      free: {
        individual: {
          pricing: '$9.99/month',
          benefits: {
            drops: ['15 drops per month (vs 3)', '20 recipients per drop (vs 3)', '300MB file uploads (vs 10MB)'],
            recipients: ['20 recipients per drop (vs 3)', '15 drops per month (vs 3)', 'Advanced analytics'],
            file_size: ['300MB file uploads (vs 10MB)', '4.5GB total storage (vs 30MB)', 'Priority support'],
            storage: ['4.5GB total storage (vs 30MB)', '300MB file uploads', 'Advanced tracking']
          }
        },
        business: {
          pricing: '$19.99/month',
          benefits: {
            drops: ['Unlimited drops', 'Unlimited recipients', 'Unlimited file size'],
            recipients: ['Unlimited recipients', 'Unlimited drops', 'Custom branding'],
            file_size: ['Unlimited file size', 'Unlimited storage', 'Custom domain'],
            storage: ['Unlimited storage', 'Unlimited file size', 'Team management']
          }
        }
      },
      individual: {
        business: {
          pricing: '$19.99/month',
          benefits: {
            drops: ['Unlimited drops (vs 15)', 'Unlimited recipients (vs 20)', 'Custom branding'],
            recipients: ['Unlimited recipients (vs 20)', 'Custom branding', 'Team management'],
            file_size: ['Unlimited file size (vs 300MB)', 'Custom domain', 'Advanced features'],
            storage: ['Unlimited storage (vs 4.5GB)', 'Custom domain', 'Priority support']
          }
        }
      }
    };

    if (currentTier === 'free') {
      return {
        suggestedPlan: 'individual',
        benefits: suggestions.free.individual.benefits[context],
        pricing: suggestions.free.individual.pricing
      };
    } else if (currentTier === 'individual') {
      return {
        suggestedPlan: 'business',
        benefits: suggestions.individual.business.benefits[context],
        pricing: suggestions.individual.business.pricing
      };
    }

    // Default fallback
    return {
      suggestedPlan: 'business',
      benefits: ['Unlimited everything', 'Custom branding', 'Priority support'],
      pricing: '$19.99/month'
    };
  }
}

// Export convenience functions
export const checkDropCreationLimits = SubscriptionGuard.checkDropCreationLimits.bind(SubscriptionGuard);
export const canAccessFeature = SubscriptionGuard.canAccessFeature.bind(SubscriptionGuard);
export const getUpgradeSuggestion = SubscriptionGuard.getUpgradeSuggestion.bind(SubscriptionGuard);