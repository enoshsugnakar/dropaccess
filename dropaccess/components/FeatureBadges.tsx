// components/FeatureBadges.tsx
'use client'

import { useState } from 'react'
import { useSubscription } from '@/components/SubscriptionProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Crown, 
  Zap, 
  Lock, 
  ArrowUp, 
  TrendingUp,
  FileBarChart,
  Download,
  Palette,
  Shield,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react'
import { useUpgradePrompt } from '@/components/UpgradePrompt'

interface FeatureBadgeProps {
  feature: 'analytics' | 'export' | 'branding' | 'priority_support' | 'custom_time' | 'bulk_actions'
  size?: 'sm' | 'md' | 'lg'
  showUpgradePrompt?: boolean
}

export function FeatureBadge({ feature, size = 'sm', showUpgradePrompt = true }: FeatureBadgeProps) {
  const { userTier } = useSubscription()
  const { showUpgradePrompt: triggerUpgradePrompt } = useUpgradePrompt()

  const featureConfig = {
    analytics: {
      name: 'Advanced Analytics',
      requiredTier: 'individual',
      icon: TrendingUp,
      description: 'Detailed access tracking and insights'
    },
    export: {
      name: 'Data Export',
      requiredTier: 'individual',
      icon: Download,
      description: 'Export analytics and drop data'
    },
    branding: {
      name: 'Custom Branding',
      requiredTier: 'business',
      icon: Palette,
      description: 'Remove DropAccess branding'
    },
    priority_support: {
      name: 'Priority Support',
      requiredTier: 'individual',
      icon: Shield,
      description: 'Faster response times'
    },
    custom_time: {
      name: 'Custom Time Limits',
      requiredTier: 'individual',
      icon: Sparkles,
      description: 'Set custom expiration times'
    },
    bulk_actions: {
      name: 'Bulk Actions',
      requiredTier: 'business',
      icon: FileBarChart,
      description: 'Manage multiple drops at once'
    }
  }

  const config = featureConfig[feature]
  const hasAccess = (
    (config.requiredTier === 'individual' && ['individual', 'business'].includes(userTier)) ||
    (config.requiredTier === 'business' && userTier === 'business') ||
    userTier === 'business' // Business tier has access to everything
  )

  const handleUpgradeClick = () => {
    if (!showUpgradePrompt) return

    triggerUpgradePrompt({
      type: 'hard',
      title: `Unlock ${config.name}`,
      description: config.description,
      suggestedPlan: config.requiredTier as 'individual' | 'business',
      ctaText: `Upgrade to ${config.requiredTier.charAt(0).toUpperCase() + config.requiredTier.slice(1)}`,
      context: 'feature'
    })
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1'
      case 'md':
        return 'text-sm px-3 py-1.5'
      case 'lg':
        return 'text-base px-4 py-2'
      default:
        return 'text-xs px-2 py-1'
    }
  }

  const IconComponent = config.icon

  if (hasAccess) {
    return (
      <Badge 
        className={`bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800 ${getSizeClasses()}`}
      >
        <IconComponent className="w-3 h-3 mr-1" />
        Available
      </Badge>
    )
  }

  return (
    <Badge 
      className={`bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors ${getSizeClasses()}`}
      onClick={handleUpgradeClick}
    >
      <Lock className="w-3 h-3 mr-1" />
      {config.requiredTier === 'individual' ? 'Individual+' : 'Business Only'}
    </Badge>
  )
}

interface FeatureGateProps {
  feature: 'analytics' | 'export' | 'branding' | 'priority_support' | 'custom_time' | 'bulk_actions'
  children: React.ReactNode
  fallback?: React.ReactNode
  showUpgradeCard?: boolean
}

export function FeatureGate({ feature, children, fallback, showUpgradeCard = true }: FeatureGateProps) {
  const { userTier } = useSubscription()
  const { showUpgradePrompt, UpgradePromptComponent } = useUpgradePrompt()

  const featureConfig = {
    analytics: {
      name: 'Advanced Analytics',
      requiredTier: 'individual',
      icon: TrendingUp,
      description: 'Get detailed insights into how your drops are being accessed',
      benefits: ['Access tracking', 'Geographic data', 'Time-based analytics', 'Export capabilities']
    },
    export: {
      name: 'Data Export',
      requiredTier: 'individual',
      icon: Download,
      description: 'Export your drop and analytics data',
      benefits: ['CSV exports', 'Analytics data', 'Drop summaries', 'Access logs']
    },
    branding: {
      name: 'Custom Branding',
      requiredTier: 'business',
      icon: Palette,
      description: 'Remove DropAccess branding and add your own',
      benefits: ['Remove branding', 'Custom logos', 'Brand colors', 'White-label experience']
    },
    priority_support: {
      name: 'Priority Support',
      requiredTier: 'individual',
      icon: Shield,
      description: 'Get faster response times and dedicated support',
      benefits: ['24/7 support', 'Faster responses', 'Phone support', 'Dedicated account manager']
    },
    custom_time: {
      name: 'Custom Time Limits',
      requiredTier: 'individual',
      icon: Sparkles,
      description: 'Set custom expiration times for your drops',
      benefits: ['Custom durations', 'Specific end dates', 'Recurring schedules', 'Timezone support']
    },
    bulk_actions: {
      name: 'Bulk Actions',
      requiredTier: 'business',
      icon: FileBarChart,
      description: 'Manage multiple drops simultaneously',
      benefits: ['Bulk delete', 'Bulk edit', 'Mass actions', 'Team management']
    }
  }

  const config = featureConfig[feature]
  const hasAccess = (
    (config.requiredTier === 'individual' && ['individual', 'business'].includes(userTier)) ||
    (config.requiredTier === 'business' && userTier === 'business')
  )

  const handleUpgradeClick = () => {
    showUpgradePrompt({
      type: 'hard',
      title: `Unlock ${config.name}`,
      description: config.description,
      suggestedPlan: config.requiredTier as 'individual' | 'business',
      ctaText: `Upgrade to ${config.requiredTier.charAt(0).toUpperCase() + config.requiredTier.slice(1)}`,
      context: 'feature'
    })
  }

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgradeCard) {
    return null
  }

  const IconComponent = config.icon

  return (
    <>
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
              <IconComponent className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {config.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
                {config.description}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-1 justify-center">
                {config.benefits.slice(0, 2).map((benefit, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {benefit}
                  </Badge>
                ))}
                {config.benefits.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{config.benefits.length - 2} more
                  </Badge>
                )}
              </div>

              <Button onClick={handleUpgradeClick} className="w-full">
                <ArrowUp className="w-4 h-4 mr-2" />
                Upgrade to {config.requiredTier.charAt(0).toUpperCase() + config.requiredTier.slice(1)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <UpgradePromptComponent />
    </>
  )
}

// Hook for checking feature access
export function useFeatureAccess() {
  const { userTier } = useSubscription()

  const hasAccess = (feature: string, requiredTier: 'individual' | 'business') => {
    if (requiredTier === 'individual') {
      return ['individual', 'business'].includes(userTier)
    }
    if (requiredTier === 'business') {
      return userTier === 'business'
    }
    return true
  }

  return {
    hasAnalytics: hasAccess('analytics', 'individual'),
    hasExport: hasAccess('export', 'individual'),
    hasBranding: hasAccess('branding', 'business'),
    hasPrioritySupport: hasAccess('priority_support', 'individual'),
    hasCustomTime: hasAccess('custom_time', 'individual'),
    hasBulkActions: hasAccess('bulk_actions', 'business'),
    userTier
  }
}

// Contextual upgrade suggestions
interface UpgradeSuggestionProps {
  context: 'drop_creation' | 'analytics_view' | 'settings' | 'dashboard'
  className?: string
}

export function UpgradeSuggestion({ context, className = '' }: UpgradeSuggestionProps) {
  const { userTier, usageData } = useSubscription()
  const { showUpgradePrompt } = useUpgradePrompt()

  if (userTier !== 'free') return null

  const suggestions = {
    drop_creation: {
      title: 'Create More Drops',
      description: 'Upgrade to create up to 15 drops per month with larger file sizes',
      cta: 'Upgrade for More Drops'
    },
    analytics_view: {
      title: 'Unlock Analytics',
      description: 'See detailed insights on how your drops are performing',
      cta: 'Get Advanced Analytics'
    },
    settings: {
      title: 'Unlock Premium Features',
      description: 'Custom branding, priority support, and unlimited drops',
      cta: 'View All Plans'
    },
    dashboard: {
      title: 'Ready to Do More?',
      description: 'Upgrade for more drops, larger files, and advanced features',
      cta: 'Upgrade Your Plan'
    }
  }

  const suggestion = suggestions[context]
  
  // Show usage-based suggestions
  if (usageData) {
    const dropsPercentage = (usageData.monthly.drops_created / usageData.limits.drops) * 100
    const storagePercentage = (usageData.monthly.storage_used_mb / usageData.limits.storage) * 100
    
    if (dropsPercentage >= 70 || storagePercentage >= 70) {
      return (
        <Card className={`bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800 ${className}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {suggestion.description}
                </p>
              </div>
              <Button 
                size="sm"
                onClick={() => showUpgradePrompt({
                  type: 'soft',
                  title: 'Upgrade Your Plan',
                  description: 'Get more capacity and unlock advanced features',
                  suggestedPlan: 'individual',
                  ctaText: 'Upgrade Now',
                  context: 'drops'
                })}
              >
                <ArrowUp className="w-3 h-3 mr-1" />
                {suggestion.cta}
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }
  }

  return null
}