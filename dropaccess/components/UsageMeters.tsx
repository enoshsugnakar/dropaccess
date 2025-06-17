// components/UsageMeters.tsx
'use client'

import { useState } from 'react'
import { useSubscription } from '@/components/SubscriptionProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  Users, 
  Database, 
  TrendingUp, 
  ArrowUp, 
  AlertTriangle,
  CheckCircle,
  Infinity,
  Crown,
  Zap
} from 'lucide-react'
import { useUpgradePrompt } from './UpgradePrompt'

interface UsageMeterProps {
  current: number
  limit: number
  label: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'purple' | 'orange'
  context: 'drops' | 'recipients' | 'file_size' | 'storage'
  unit?: string
}

function UsageMeter({ current, limit, label, icon: Icon, color, context, unit = '' }: UsageMeterProps) {
  const { userTier } = useSubscription()
  const { showUpgradePrompt, UpgradePromptComponent } = useUpgradePrompt()
  
  const isUnlimited = limit === -1
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100)
  const isNearLimit = percentage >= 80
  const isAtLimit = percentage >= 100

  const getColorClasses = () => {
    const colors = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-600 dark:text-blue-400',
        progress: 'bg-blue-500',
        border: 'border-blue-200 dark:border-blue-800'
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-600 dark:text-green-400',
        progress: 'bg-green-500',
        border: 'border-green-200 dark:border-green-800'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-purple-600 dark:text-purple-400',
        progress: 'bg-purple-500',
        border: 'border-purple-200 dark:border-purple-800'
      },
      orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-600 dark:text-orange-400',
        progress: 'bg-orange-500',
        border: 'border-orange-200 dark:border-orange-800'
      }
    }
    return colors[color]
  }

  const getProgressColor = () => {
    if (isUnlimited) return 'bg-green-500'
    if (isAtLimit) return 'bg-red-500'
    if (isNearLimit) return 'bg-orange-500'
    return getColorClasses().progress
  }

  const handleUpgradeClick = () => {
    const upgradeConfig = {
      type: isAtLimit ? 'hard' as const : 'soft' as const,
      title: isAtLimit ? `${label} Limit Reached` : `Almost at ${label} Limit`,
      description: isAtLimit 
        ? `You've reached your ${label.toLowerCase()} limit. Upgrade to continue.`
        : `You're using ${Math.round(percentage)}% of your ${label.toLowerCase()}. Consider upgrading for more capacity.`,
      suggestedPlan: userTier === 'free' ? 'individual' as const : 'business' as const,
      ctaText: userTier === 'free' ? 'Upgrade to Individual' : 'Upgrade to Business',
      context,
      blockingAction: isAtLimit
    }
    showUpgradePrompt(upgradeConfig)
  }

  const colorClasses = getColorClasses()

  return (
    <>
      <Card className={`${colorClasses.border} border-l-4 ${colorClasses.bg}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${colorClasses.text}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {isUnlimited ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <Infinity className="w-3 h-3 mr-1" />
                  Unlimited
                </Badge>
              ) : (
                <span className={`text-sm font-mono ${
                  isAtLimit ? 'text-red-600 dark:text-red-400' : 
                  isNearLimit ? 'text-orange-600 dark:text-orange-400' : 
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {current.toLocaleString()}/{limit.toLocaleString()}{unit}
                </span>
              )}
            </div>
          </div>

          {!isUnlimited && (
            <div className="space-y-2">
              <Progress 
                value={percentage} 
                className="h-2"
                style={{
                  background: 'rgb(229 231 235)',
                }}
              />
              <div className="flex items-center justify-between text-xs">
                <span className={`${
                  isAtLimit ? 'text-red-600 dark:text-red-400' : 
                  isNearLimit ? 'text-orange-600 dark:text-orange-400' : 
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {Math.round(percentage)}% used
                </span>
                {(isNearLimit || isAtLimit) && userTier !== 'business' && (
                  <Button
                    onClick={handleUpgradeClick}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs hover:bg-white/50"
                  >
                    <ArrowUp className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                )}
              </div>
            </div>
          )}

          {isUnlimited && (
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">No limits</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <UpgradePromptComponent />
    </>
  )
}

export function UsageMetersGrid() {
  const { usageData, userTier, loading, error } = useSubscription()

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading usage data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !usageData) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>Unable to load usage data</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            userTier === 'business' ? 'bg-purple-50 dark:bg-purple-900/20' :
            userTier === 'individual' ? 'bg-blue-50 dark:bg-blue-900/20' :
            'bg-gray-50 dark:bg-gray-800'
          }`}>
            {userTier === 'business' ? (
              <Crown className="w-5 h-5 text-purple-500" />
            ) : userTier === 'individual' ? (
              <Zap className="w-5 h-5 text-blue-500" />
            ) : (
              <TrendingUp className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Usage Overview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Current plan: {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
            </p>
          </div>
        </div>
        <Badge variant={userTier === 'free' ? 'outline' : 'default'}>
          {userTier === 'free' ? 'Free Plan' : 
           userTier === 'individual' ? 'Individual' : 'Business'}
        </Badge>
      </div>

      {/* Usage Meters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UsageMeter
          current={usageData.monthly.drops_created}
          limit={usageData.limits.drops}
          label="Monthly Drops"
          icon={FileText}
          color="blue"
          context="drops"
        />
        
        <UsageMeter
          current={usageData.monthly.recipients_added}
          limit={usageData.limits.recipients === -1 ? -1 : usageData.limits.recipients * usageData.monthly.drops_created}
          label="Recipients Added"
          icon={Users}
          color="green"
          context="recipients"
        />
        
        <UsageMeter
          current={Math.round(usageData.monthly.storage_used_mb)}
          limit={usageData.limits.storage}
          label="Storage Used"
          icon={Database}
          color="purple"
          context="storage"
          unit="MB"
        />
        
        {/* File Size Limit Indicator */}
        <Card className="border-l-4 border-l-orange-200 dark:border-l-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Max File Size</span>
              </div>
              <div className="flex items-center gap-2">
                {usageData.limits.storage === -1 ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    <Infinity className="w-3 h-3 mr-1" />
                    Unlimited
                  </Badge>
                ) : (
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    {usageData.limits.storage}MB
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">
                  {usageData.limits.storage === -1 ? 'No file size limits' : `Upload files up to ${usageData.limits.storage}MB`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade CTA for free users */}
      {userTier === 'free' && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Ready to unlock more features?
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upgrade to get more drops, larger file uploads, and advanced features.
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <span>15 drops/month</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <span>300MB files</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <span>20 recipients</span>
                  </div>
                </div>
              </div>
              <Button asChild className="shrink-0">
                <a href="/settings">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Upgrade Plan
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default UsageMetersGrid