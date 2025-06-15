'use client'

import { useState } from 'react'
import { useSubscription } from '@/components/SubscriptionProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Crown, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  Settings,
  Zap,
  Database,
  Users,
  FileText,
  ArrowUp,
  CreditCard,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw
} from 'lucide-react'

export function SubscriptionStatus() {
  const { 
    usageData, 
    userTier, 
    loading, 
    error, 
    refreshData, 
    lastUpdated 
  } = useSubscription()
  const [isOpen, setIsOpen] = useState(false)

  // Show loading state
  if (loading) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <div>
              <p className="font-medium">Loading subscription data...</p>
              <p className="text-sm text-gray-500">Please wait</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show error state
  if (error) {
    return (
      <Card className="border-l-4 border-l-red-500">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  Failed to load subscription data
                </p>
                <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
              </div>
            </div>
            <Button onClick={refreshData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No data available
  if (!usageData) {
    return (
      <Card className="border-l-4 border-l-gray-300">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium">No subscription data available</p>
                <p className="text-sm text-gray-500">Unable to load your plan information</p>
              </div>
            </div>
            <Button onClick={refreshData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getTierInfo = () => {
    switch (userTier) {
      case 'business':
        return {
          color: 'purple',
          icon: Crown,
          borderColor: 'border-l-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          textColor: 'text-purple-700 dark:text-purple-400',
          badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        }
      case 'individual':
        return {
          color: 'blue',
          icon: Crown,
          borderColor: 'border-l-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-700 dark:text-blue-400',
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        }
      default:
        return {
          color: 'gray',
          icon: Zap,
          borderColor: 'border-l-gray-300',
          bgColor: 'bg-gray-50 dark:bg-gray-800/50',
          textColor: 'text-gray-700 dark:text-gray-400',
          badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        }
    }
  }

  const tierInfo = getTierInfo()
  const TierIcon = tierInfo.icon

  const calculateUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0 // Unlimited
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400'
    if (percentage >= 75) return 'text-amber-600 dark:text-amber-400'
    return 'text-green-600 dark:text-green-400'
  }

  const dropsPercentage = calculateUsagePercentage(
    usageData.monthly.drops_created, 
    usageData.limits.drops
  )
  const storagePercentage = calculateUsagePercentage(
    usageData.monthly.storage_used_mb, 
    usageData.limits.storage
  )

  return (
    <Card className={`${tierInfo.borderColor} transition-all duration-200`}>
      <CardHeader 
        className="cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${tierInfo.bgColor}`}>
              <TierIcon className={`w-5 h-5 ${tierInfo.textColor}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>Current Plan</span>
                <Badge className={tierInfo.badgeColor}>
                  {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
                </Badge>
              </CardTitle>
              <CardDescription>
                {userTier === 'free' && 'Upgrade to unlock more features'}
                {userTier === 'individual' && 'Perfect for personal use'}
                {userTier === 'business' && 'Full-featured business plan'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000 / 60)}m ago
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                refreshData()
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          <div className="space-y-6">
            {/* Usage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Drops Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Drops</span>
                  </div>
                  <span className={`text-sm font-mono ${getUsageColor(dropsPercentage)}`}>
                    {usageData.monthly.drops_created}
                    {usageData.limits.drops !== -1 && `/${usageData.limits.drops}`}
                  </span>
                </div>
                {usageData.limits.drops !== -1 && (
                  <div className="space-y-1">
                    <Progress 
                      value={dropsPercentage} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500">
                      {Math.round(dropsPercentage)}% used this month
                    </p>
                  </div>
                )}
                {usageData.limits.drops === -1 && (
                  <p className="text-xs text-green-600 dark:text-green-400">Unlimited</p>
                )}
              </div>

              {/* Recipients */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Recipients</span>
                  </div>
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    {usageData.monthly.recipients_added}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Max {usageData.limits.recipients === -1 ? 'unlimited' : usageData.limits.recipients} per drop
                </p>
              </div>

              {/* Storage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">Storage</span>
                  </div>
                  <span className={`text-sm font-mono ${getUsageColor(storagePercentage)}`}>
                    {Math.round(usageData.monthly.storage_used_mb)}
                    {usageData.limits.storage !== -1 && `/${usageData.limits.storage}`} MB
                  </span>
                </div>
                {usageData.limits.storage !== -1 && (
                  <div className="space-y-1">
                    <Progress 
                      value={storagePercentage} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500">
                      {Math.round(storagePercentage)}% used
                    </p>
                  </div>
                )}
                {usageData.limits.storage === -1 && (
                  <p className="text-xs text-green-600 dark:text-green-400">Unlimited</p>
                )}
              </div>
            </div>

            {/* Upgrade CTA for free users */}
            {userTier === 'free' && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Ready to unlock more features?
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Upgrade to get more drops, larger file uploads, and advanced features.
                    </p>
                  </div>
                  <Button asChild>
                    <a href="/settings">
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Upgrade
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Plan Info */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Plan Status</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {usageData.subscription.status === 'active' ? 'Active' : 'Free'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}