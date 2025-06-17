import { supabaseAdmin } from '@/lib/supabaseClient';
import { TIER_LIMITS, type TierType, getCurrentUsage } from '@/lib/usageTracking';

// Types for subscription checking
export interface SubscriptionCheck {
  allowed: boolean;
  reason?: string;
  upgradePrompt?: UpgradePrompt;
  currentUsage?: any;
  limits?: any;
}

export interface UpgradePrompt {
  type: 'soft' | 'hard' | 'feature';
  title: string;
  description: string;
  cta: string;
  urgency: 'low' | 'medium' | 'high';
  featureBlocked?: string;
}

export interface FeatureAccess {
  hasAccess: boolean;
  feature: string;
  reason?: string;
  upgradeRequired?: boolean;
}

// Core subscription guard class
class SubscriptionGuard {
  
  /**
   * Check if user can create a new drop
   */
  async checkDropCreation(userId: string, recipientCount: number, fileSizeMb: number = 0): Promise<SubscriptionCheck> {
    try {
      if (!supabaseAdmin) {
        return {
          allowed: false,
          reason: 'Database configuration error'
        };
      }

      // Get user's subscription tier
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('subscription_tier, subscription_status, email')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return {
          allowed: false,
          reason: 'User not found'
        };
      }

      const tier = (user.subscription_tier || 'free') as TierType;
      const limits = TIER_LIMITS[tier];
      const usage = await getCurrentUsage(userId);

      // Check each limit
      const checks = {
        dropCount: this.checkDropLimit(usage.drops_created, limits.drops_per_month),
        recipientCount: this.checkRecipientLimit(recipientCount, limits.recipients_per_drop),
        fileSize: this.checkFileSizeLimit(fileSizeMb, limits.file_size_mb),
        storage: this.checkStorageLimit(usage.storage_used_mb + fileSizeMb, limits.storage_total_mb)
      };

      // Find the first failing check
      const failedCheck = Object.entries(checks).find(([_, check]) => !check.allowed);

      if (failedCheck) {
        const [checkType, checkResult] = failedCheck;
        return {
          allowed: false,
          reason: checkResult.reason,
          upgradePrompt: this.generateUpgradePrompt(checkType, tier, checkResult),
          currentUsage: usage,
          limits
        };
      }

      // All checks passed
      return {
        allowed: true,
        currentUsage: usage,
        limits
      };

    } catch (error) {
      console.error('Error in checkDropCreation:', error);
      return {
        allowed: false,
        reason: 'System error occurred'
      };
    }
  }

  /**
   * Check if user can access a specific feature
   */
  async checkFeatureAccess(userId: string, feature: string): Promise<FeatureAccess> {
    try {
      if (!supabaseAdmin) {
        return {
          hasAccess: false,
          feature,
          reason: 'Database configuration error'
        };
      }

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return {
          hasAccess: false,
          feature,
          reason: 'User not found'
        };
      }

      const tier = (user.subscription_tier || 'free') as TierType;
      const limits = TIER_LIMITS[tier];

      switch (feature) {
        case 'advanced_analytics':
          return {
            hasAccess: limits.analytics === 'advanced' || limits.analytics === 'premium',
            feature,
            upgradeRequired: limits.analytics === 'basic'
          };

        case 'premium_analytics':
          return {
            hasAccess: limits.analytics === 'premium',
            feature,
            upgradeRequired: limits.analytics !== 'premium'
          };

        case 'custom_branding':
          return {
            hasAccess: limits.custom_branding,
            feature,
            upgradeRequired: !limits.custom_branding
          };

        case 'export_data':
          return {
            hasAccess: limits.export_data,
            feature,
            upgradeRequired: !limits.export_data
          };

        case 'unlimited_recipients':
          return {
            hasAccess: limits.recipients_per_drop === -1,
            feature,
            upgradeRequired: limits.recipients_per_drop !== -1
          };

        case 'large_file_uploads':
          return {
            hasAccess: limits.file_size_mb > 10,
            feature,
            upgradeRequired: limits.file_size_mb <= 10
          };

        default:
          return {
            hasAccess: false,
            feature,
            reason: 'Unknown feature'
          };
      }

    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        hasAccess: false,
        feature,
        reason: 'System error'
      };
    }
  }

  /**
   * Get usage status with upgrade prompts
   */
  async getUsageStatus(userId: string): Promise<{
    usage: any;
    limits: any;
    tier: TierType;
    warnings: UpgradePrompt[];
    percentages: any;
  }> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Database configuration error');
      }

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      const tier = (user.subscription_tier || 'free') as TierType;
      const limits = TIER_LIMITS[tier];
      const usage = await getCurrentUsage(userId);

      // Calculate usage percentages
      const percentages = {
        drops: limits.drops_per_month === -1 ? 0 : (usage.drops_created / limits.drops_per_month) * 100,
        storage: limits.storage_total_mb === -1 ? 0 : (usage.storage_used_mb / limits.storage_total_mb) * 100
      };

      // Generate warnings based on usage
      const warnings: UpgradePrompt[] = [];

      // Drop limit warnings
      if (percentages.drops >= 80 && percentages.drops < 100) {
        warnings.push({
          type: 'soft',
          title: 'Approaching drop limit',
          description: `You've used ${Math.round(percentages.drops)}% of your monthly drops. Upgrade to get more!`,
          cta: 'Upgrade Plan',
          urgency: 'medium'
        });
      } else if (percentages.drops >= 100) {
        warnings.push({
          type: 'hard',
          title: 'Drop limit reached',
          description: 'You\'ve reached your monthly drop limit. Upgrade to create more drops.',
          cta: 'Upgrade Now',
          urgency: 'high'
        });
      }

      // Storage warnings
      if (percentages.storage >= 80 && percentages.storage < 100) {
        warnings.push({
          type: 'soft',
          title: 'Storage almost full',
          description: `You've used ${Math.round(percentages.storage)}% of your storage. Upgrade for more space!`,
          cta: 'Get More Storage',
          urgency: 'medium'
        });
      } else if (percentages.storage >= 100) {
        warnings.push({
          type: 'hard',
          title: 'Storage full',
          description: 'Your storage is full. Upgrade to upload larger files.',
          cta: 'Upgrade Storage',
          urgency: 'high'
        });
      }

      return {
        usage,
        limits,
        tier,
        warnings,
        percentages
      };

    } catch (error) {
      console.error('Error getting usage status:', error);
      throw error;
    }
  }

  /**
   * Check specific limits
   */
  private checkDropLimit(currentDrops: number, limit: number): SubscriptionCheck {
    if (limit === -1) return { allowed: true }; // Unlimited
    
    return {
      allowed: currentDrops < limit,
      reason: currentDrops >= limit ? 
        `Monthly drop limit reached (${currentDrops}/${limit})` : undefined
    };
  }

  private checkRecipientLimit(recipientCount: number, limit: number): SubscriptionCheck {
    if (limit === -1) return { allowed: true }; // Unlimited
    
    return {
      allowed: recipientCount <= limit,
      reason: recipientCount > limit ? 
        `Too many recipients (${recipientCount}/${limit} allowed)` : undefined
    };
  }

  private checkFileSizeLimit(fileSizeMb: number, limit: number): SubscriptionCheck {
    if (limit === -1) return { allowed: true }; // Unlimited
    
    return {
      allowed: fileSizeMb <= limit,
      reason: fileSizeMb > limit ? 
        `File too large (${fileSizeMb}MB/${limit}MB allowed)` : undefined
    };
  }

  private checkStorageLimit(totalStorageMb: number, limit: number): SubscriptionCheck {
    if (limit === -1) return { allowed: true }; // Unlimited
    
    return {
      allowed: totalStorageMb <= limit,
      reason: totalStorageMb > limit ? 
        `Storage limit exceeded (${Math.round(totalStorageMb)}MB/${limit}MB available)` : undefined
    };
  }

  /**
   * Generate contextual upgrade prompts
   */
  private generateUpgradePrompt(checkType: string, tier: TierType, checkResult: SubscriptionCheck): UpgradePrompt {
    const upgradePrompts: Record<string, Record<string, UpgradePrompt>> = {
      dropCount: {
        free: {
          type: 'hard' as const,
          title: 'Monthly drop limit reached',
          description: 'You\'ve created 3 drops this month. Upgrade to Individual for 15 drops per month!',
          cta: 'Upgrade to Individual',
          urgency: 'high' as const
        },
        individual: {
          type: 'hard' as const,
          title: 'Monthly drop limit reached',
          description: 'You\'ve created 15 drops this month. Upgrade to Business for unlimited drops!',
          cta: 'Upgrade to Business',
          urgency: 'high' as const
        }
      },
      recipientCount: {
        free: {
          type: 'hard' as const,
          title: 'Recipient limit exceeded',
          description: 'Free plan allows up to 3 recipients. Upgrade to Individual for 20 recipients per drop!',
          cta: 'Upgrade for More Recipients',
          urgency: 'high' as const
        },
        individual: {
          type: 'hard' as const,
          title: 'Recipient limit exceeded',
          description: 'Individual plan allows up to 20 recipients. Upgrade to Business for unlimited recipients!',
          cta: 'Upgrade to Business',
          urgency: 'high' as const
        }
      },
      fileSize: {
        free: {
          type: 'hard' as const,
          title: 'File size limit exceeded',
          description: 'Free plan supports files up to 10MB. Upgrade to Individual for 300MB files!',
          cta: 'Upgrade for Larger Files',
          urgency: 'high' as const
        },
        individual: {
          type: 'hard' as const,
          title: 'File size limit exceeded',
          description: 'Individual plan supports files up to 300MB. Upgrade to Business for unlimited file sizes!',
          cta: 'Upgrade to Business',
          urgency: 'high' as const
        }
      },
      storage: {
        free: {
          type: 'hard' as const,
          title: 'Storage limit reached',
          description: 'You\'ve used all 30MB of storage. Upgrade to Individual for 4.5GB of storage!',
          cta: 'Upgrade for More Storage',
          urgency: 'high' as const
        },
        individual: {
          type: 'hard' as const,
          title: 'Storage limit reached',
          description: 'You\'ve used all 4.5GB of storage. Upgrade to Business for unlimited storage!',
          cta: 'Upgrade to Business',
          urgency: 'high' as const
        }
      }
    };

    const prompt = upgradePrompts[checkType]?.[tier];
    
    return prompt || {
      type: 'hard',
      title: 'Upgrade required',
      description: checkResult.reason || 'This action requires a plan upgrade.',
      cta: 'Upgrade Plan',
      urgency: 'high'
    };
  }
}

// Export singleton instance
export const subscriptionGuard = new SubscriptionGuard();

// Convenience functions
export const checkDropCreation = (userId: string, recipientCount: number, fileSizeMb?: number) => 
  subscriptionGuard.checkDropCreation(userId, recipientCount, fileSizeMb);

export const checkFeatureAccess = (userId: string, feature: string) => 
  subscriptionGuard.checkFeatureAccess(userId, feature);

export const getUsageStatus = (userId: string) => 
  subscriptionGuard.getUsageStatus(userId);

// Feature check helpers for UI components
export const canAccessAdvancedAnalytics = (userId: string) => 
  checkFeatureAccess(userId, 'advanced_analytics');

export const canAccessCustomBranding = (userId: string) => 
  checkFeatureAccess(userId, 'custom_branding');

export const canExportData = (userId: string) => 
  checkFeatureAccess(userId, 'export_data');

export const canUploadLargeFiles = (userId: string) => 
  checkFeatureAccess(userId, 'large_file_uploads');