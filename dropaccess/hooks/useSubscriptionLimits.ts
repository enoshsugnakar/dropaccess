// hooks/useSubscriptionLimits.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import { checkDropCreationLimits, canAccessFeature, LimitCheckResult, DropCreationLimits } from '@/lib/subscription-limits'
import { useUpgradePrompt } from '@/components/UpgradePrompt'

export interface UseLimitCheckOptions {
  recipientCount?: number
  fileSizeMb?: number
  autoCheck?: boolean
  showUpgradePrompts?: boolean
}

export function useSubscriptionLimits(options: UseLimitCheckOptions = {}) {
  const { user } = useAuth()
  const { userTier, usageData } = useSubscription()
  const { showUpgradePrompt } = useUpgradePrompt()
  
  const [limitChecks, setLimitChecks] = useState<DropCreationLimits | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkLimits = useCallback(async (
    recipientCount: number = 0, 
    fileSizeMb: number = 0
  ): Promise<DropCreationLimits | null> => {
    if (!user?.id) return null

    try {
      setIsChecking(true)
      const checks = await checkDropCreationLimits(user.id, recipientCount, fileSizeMb)
      setLimitChecks(checks)
      setLastChecked(new Date())
      return checks
    } catch (error) {
      console.error('Error checking subscription limits:', error)
      return null
    } finally {
      setIsChecking(false)
    }
  }, [user?.id])

  // Auto-check when dependencies change
  useEffect(() => {
    if (options.autoCheck && user?.id) {
      checkLimits(options.recipientCount || 0, options.fileSizeMb || 0)
    }
  }, [options.autoCheck, options.recipientCount, options.fileSizeMb, user?.id, checkLimits])

  const canProceed = limitChecks ? Object.values(limitChecks).every(check => check.allowed) : true

  const getBlockingIssues = useCallback(() => {
    if (!limitChecks) return []
    
    return Object.entries(limitChecks)
      .filter(([_, check]) => !check.allowed)
      .map(([key, check]) => ({
        type: key as keyof DropCreationLimits,
        reason: check.reason,
        upgradePrompt: check.upgradePrompt
      }))
  }, [limitChecks])

  const handleLimitExceeded = useCallback((issueType?: keyof DropCreationLimits) => {
    if (!options.showUpgradePrompts) return

    const issues = getBlockingIssues()
    const issue = issueType ? issues.find(i => i.type === issueType) : issues[0]
    
    if (issue?.upgradePrompt) {
      showUpgradePrompt({
        ...issue.upgradePrompt,
        blockingAction: true
      })
    }
  }, [getBlockingIssues, options.showUpgradePrompts, showUpgradePrompt])

  return {
    // State
    limitChecks,
    canProceed,
    isChecking,
    lastChecked,
    userTier,
    usageData,
    
    // Actions
    checkLimits,
    getBlockingIssues,
    handleLimitExceeded,
    
    // Convenience getters
    canCreateDrop: limitChecks?.canCreateDrop.allowed ?? true,
    canAddRecipients: limitChecks?.canAddRecipients.allowed ?? true,
    canUploadFile: limitChecks?.canUploadFile.allowed ?? true,
    hasStorageSpace: limitChecks?.hasStorageSpace.allowed ?? true
  }
}

// Hook for feature access checking
export function useFeatureLimits() {
  const { user } = useAuth()
  const { userTier } = useSubscription()
  const { showUpgradePrompt } = useUpgradePrompt()
  
  const [featureChecks, setFeatureChecks] = useState<Record<string, LimitCheckResult>>({})

  const checkFeatureAccess = useCallback(async (feature: 'analytics' | 'export' | 'branding') => {
    if (!user?.id) return false

    try {
      const result = await canAccessFeature(user.id, feature)
      setFeatureChecks(prev => ({ ...prev, [feature]: result }))
      return result.allowed
    } catch (error) {
      console.error(`Error checking ${feature} access:`, error)
      return false
    }
  }, [user?.id])

  const requireFeature = useCallback(async (
    feature: 'analytics' | 'export' | 'branding',
    showPrompt: boolean = true
  ): Promise<boolean> => {
    const hasAccess = await checkFeatureAccess(feature)
    
    if (!hasAccess && showPrompt) {
      const featureCheck = featureChecks[feature]
      if (featureCheck?.upgradePrompt) {
        showUpgradePrompt({
          ...featureCheck.upgradePrompt,
          blockingAction: true
        })
      }
    }
    
    return hasAccess
  }, [checkFeatureAccess, featureChecks, showUpgradePrompt])

  // Quick access helpers
  const hasAnalytics = userTier !== 'free'
  const hasExport = userTier !== 'free'
  const hasBranding = userTier === 'business'

  return {
    // State
    featureChecks,
    userTier,
    
    // Actions
    checkFeatureAccess,
    requireFeature,
    
    // Quick checks
    hasAnalytics,
    hasExport,
    hasBranding,
    
    // Convenience methods
    requireAnalytics: () => requireFeature('analytics'),
    requireExport: () => requireFeature('export'),
    requireBranding: () => requireFeature('branding')
  }
}

// Hook for usage warnings and notifications
export function useUsageWarnings() {
  const { usageData, userTier } = useSubscription()
  const { showUpgradePrompt } = useUpgradePrompt()
  
  const [warnings, setWarnings] = useState<Array<{
    type: 'drops' | 'storage' | 'recipients'
    severity: 'info' | 'warning' | 'critical'
    message: string
    action?: () => void
  }>>([])

  useEffect(() => {
    if (!usageData || userTier === 'business') {
      setWarnings([])
      return
    }

    const newWarnings = []

    // Check drops usage
    if (usageData.limits.drops !== -1) {
      const dropsPercentage = (usageData.monthly.drops_created / usageData.limits.drops) * 100
      
      if (dropsPercentage >= 90) {
        newWarnings.push({
          type: 'drops' as const,
          severity: 'critical' as const,
          message: `You've used ${usageData.monthly.drops_created}/${usageData.limits.drops} drops this month`,
          action: () => showUpgradePrompt({
            type: 'soft',
            title: 'Almost at Drop Limit',
            description: 'Consider upgrading to create more drops',
            suggestedPlan: userTier === 'free' ? 'individual' : 'business',
            ctaText: 'Upgrade Plan',
            context: 'drops'
          })
        })
      } else if (dropsPercentage >= 70) {
        newWarnings.push({
          type: 'drops' as const,
          severity: 'warning' as const,
          message: `${Math.round(100 - dropsPercentage)}% of drops remaining this month`,
          action: () => showUpgradePrompt({
            type: 'soft',
            title: 'Approaching Drop Limit',
            description: 'You might want to consider upgrading',
            suggestedPlan: userTier === 'free' ? 'individual' : 'business',
            ctaText: 'View Plans',
            context: 'drops'
          })
        })
      }
    }

    // Check storage usage
    if (usageData.limits.storage !== -1) {
      const storagePercentage = (usageData.monthly.storage_used_mb / usageData.limits.storage) * 100
      
      if (storagePercentage >= 90) {
        newWarnings.push({
          type: 'storage' as const,
          severity: 'critical' as const,
          message: `Storage almost full: ${Math.round(usageData.monthly.storage_used_mb)}/${usageData.limits.storage}MB`,
          action: () => showUpgradePrompt({
            type: 'soft',
            title: 'Storage Almost Full',
            description: 'Upgrade for more storage space',
            suggestedPlan: userTier === 'free' ? 'individual' : 'business',
            ctaText: 'Get More Storage',
            context: 'storage'
          })
        })
      } else if (storagePercentage >= 70) {
        newWarnings.push({
          type: 'storage' as const,
          severity: 'warning' as const,
          message: `${Math.round(100 - storagePercentage)}% storage remaining`,
          action: () => showUpgradePrompt({
            type: 'soft',
            title: 'Storage Usage High',
            description: 'Consider upgrading for more space',
            suggestedPlan: userTier === 'free' ? 'individual' : 'business',
            ctaText: 'View Plans',
            context: 'storage'
          })
        })
      }
    }

    setWarnings(newWarnings)
  }, [usageData, userTier, showUpgradePrompt])

  return {
    warnings,
    hasWarnings: warnings.length > 0,
    criticalWarnings: warnings.filter(w => w.severity === 'critical'),
    warningCount: warnings.length
  }
}

// Middleware hook for protecting routes/actions
export function useSubscriptionGuard() {
  const { userTier } = useSubscription()
  const { showUpgradePrompt } = useUpgradePrompt()

  const requireTier = useCallback((
    requiredTier: 'individual' | 'business',
    context: string = 'feature'
  ): boolean => {
    const hasAccess = (
      (requiredTier === 'individual' && ['individual', 'business'].includes(userTier)) ||
      (requiredTier === 'business' && userTier === 'business')
    )

    if (!hasAccess) {
      showUpgradePrompt({
        type: 'hard',
        title: 'Upgrade Required',
        description: `This feature requires the ${requiredTier} plan or higher`,
        suggestedPlan: requiredTier,
        ctaText: `Upgrade to ${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}`,
        context: 'feature',
        blockingAction: true
      })
    }

    return hasAccess
  }, [userTier, showUpgradePrompt])

  const withTierCheck = useCallback(<T extends any[]>(
    requiredTier: 'individual' | 'business',
    action: (...args: T) => void | Promise<void>,
    context?: string
  ) => {
    return (...args: T) => {
      if (requireTier(requiredTier, context)) {
        return action(...args)
      }
    }
  }, [requireTier])

  return {
    userTier,
    requireTier,
    withTierCheck,
    
    // Convenience methods
    requireIndividual: (context?: string) => requireTier('individual', context),
    requireBusiness: (context?: string) => requireTier('business', context),
    
    // Higher-order function helpers
    withIndividualTier: <T extends any[]>(action: (...args: T) => void | Promise<void>, context?: string) => 
      withTierCheck('individual', action, context),
    withBusinessTier: <T extends any[]>(action: (...args: T) => void | Promise<void>, context?: string) => 
      withTierCheck('business', action, context)
  }
}

// Context-aware upgrade suggestions
export function useSmartUpgradeSuggestions() {
  const { usageData, userTier } = useSubscription()
  const { warnings } = useUsageWarnings()
  const { showUpgradePrompt } = useUpgradePrompt()

  const getSuggestion = useCallback((context: 'dashboard' | 'create' | 'analytics' | 'settings') => {
    if (userTier !== 'free') return null

    const hasWarnings = warnings.length > 0
    const criticalWarnings = warnings.filter(w => w.severity === 'critical')

    // Contextual suggestions based on current state
    if (criticalWarnings.length > 0) {
      const warning = criticalWarnings[0]
      return {
        priority: 'high',
        title: 'Upgrade Needed',
        description: warning.message,
        cta: 'Upgrade Now',
        action: warning.action
      }
    }

    if (hasWarnings) {
      return {
        priority: 'medium',
        title: 'Consider Upgrading',
        description: 'You\'re approaching your plan limits',
        cta: 'View Plans',
        action: () => showUpgradePrompt({
          type: 'soft',
          title: 'Plan Limits Approaching',
          description: 'Upgrade to get more capacity and features',
          suggestedPlan: 'individual',
          ctaText: 'Upgrade to Individual',
          context: 'drops'
        })
      }
    }

    // Context-specific suggestions
    const contextSuggestions = {
      dashboard: {
        priority: 'low',
        title: 'Unlock More Features',
        description: 'Get analytics, more drops, and larger file uploads',
        cta: 'Upgrade Plan'
      },
      create: {
        priority: 'medium',
        title: 'Need More Capacity?',
        description: 'Upgrade for 15 drops/month and 300MB file uploads',
        cta: 'Upgrade for More'
      },
      analytics: {
        priority: 'high',
        title: 'Analytics Available',
        description: 'Get detailed insights with Individual or Business plans',
        cta: 'Unlock Analytics'
      },
      settings: {
        priority: 'low',
        title: 'Explore Premium',
        description: 'See all available features and plans',
        cta: 'View All Plans'
      }
    }

    return {
      ...contextSuggestions[context],
      action: () => showUpgradePrompt({
        type: 'soft',
        title: 'Upgrade Your Experience',
        description: 'Unlock more features and capacity',
        suggestedPlan: 'individual',
        ctaText: 'Upgrade to Individual',
        context: 'feature'
      })
    }
  }, [userTier, warnings, showUpgradePrompt])

  return {
    getSuggestion,
    hasUpgradeSuggestions: userTier === 'free',
    warningBasedSuggestions: warnings.length > 0
  }
}