'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
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
  ExternalLink,
  Settings,
  Zap,
  Database,
  Users,
  FileText,
  ArrowUp,
  CreditCard
} from 'lucide-react'
import { getUsageSummary, formatFileSize, getUsageColor } from '@/lib/usageTracking'

interface UsageSummary {
  tier: 'free' | 'individual' | 'business'
  limits: {
    drops_per_month: number
    recipients_per_drop: number  
    file_size_mb: number
    storage_total_mb: number
    analytics: string
    custom_branding: boolean
    export_data: boolean
  }
  current: {
    drops_created: number
    recipients_added: number
    storage_used_mb: number
  }
  percentages: {
    drops: number
    storage: number
  }
  subscriptionStatus: string
}

interface SubscriptionData {
  hasSubscription: boolean
  subscription: any
}

export function SubscriptionStatus() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchSubscriptionData()
    }
  }, [user?.id])

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch usage summary
      const usage = await getUsageSummary(user!.id)
      setUsageSummary(usage)

      // Fetch subscription details
      const response = await fetch(`/api/payments/manage?userId=${user!.id}`)
      if (response.ok) {
        const data = await response.json()
        setSubscriptionData(data)
      }

    } catch (err: any) {
      console.error('Error fetching subscription data:', err)
      setError('Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const getPlanInfo = () => {
    if (!usageSummary) return null

    const planConfig = {
      free: {
        name: 'Free Plan',
        color: 'bg-gray-100 text-gray-800',
        icon: FileText,
        price: '$0/month'
      },
      individual: {
        name: 'Individual Plan',
        color: 'bg-blue-100 text-blue-800',
        icon: Crown,
        price: '$9.99/month'
      },
      business: {
        name: 'Business Plan',
        color: 'bg-purple-100 text-purple-800',
        icon: Zap,
        price: '$19.99/month'
      }
    }

    return planConfig[usageSummary.tier]
  }

  const handleUpgrade = () => {
    // Scroll to pricing section on homepage
    window.location.href = '/#pricing'
  }

  const handleManageBilling = async () => {
    try {
      // This would open a billing portal - for now, redirect to manage API
      const response = await fetch('/api/payments/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'portal',
          userId: user!.id,
          userEmail: user!.email
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.portal_url) {
          window.open(data.portal_url, '_blank')
        }
      }
    } catch (error) {
      console.error('Error opening billing portal:', error)
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <CardTitle>Loading Subscription...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Error Loading Subscription
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchSubscriptionData} variant="outline" size="sm">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!usageSummary) return null

  const planInfo = getPlanInfo()
  const isFreePlan = usageSummary.tier === 'free'
  const isPaidPlan = !isFreePlan

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {planInfo && (
                <>
                  <div className={`p-2 rounded-lg ${planInfo.color}`}>
                    <planInfo.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{planInfo.name}</CardTitle>
                    <CardDescription>
                      {planInfo.price} • {usageSummary.subscriptionStatus}
                    </CardDescription>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {isPaidPlan && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              )}
              
              {isFreePlan ? (
                <Button onClick={handleUpgrade} size="sm">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Upgrade
                </Button>
              ) : (
                <Button onClick={handleManageBilling} variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Drops Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drops This Month
                </span>
                <span className="text-sm text-gray-500">
                  {usageSummary.current.drops_created} / {usageSummary.limits.drops_per_month === -1 ? '∞' : usageSummary.limits.drops_per_month}
                </span>
              </div>
              <Progress 
                value={usageSummary.percentages.drops} 
                className="h-2"
              />
              <span className={`text-xs font-medium ${getUsageColor(usageSummary.percentages.drops)}`}>
                {usageSummary.percentages.drops.toFixed(1)}% used
              </span>
            </div>

            {/* Storage Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Storage Used
                </span>
                <span className="text-sm text-gray-500">
                  {formatFileSize(usageSummary.current.storage_used_mb)} / {usageSummary.limits.storage_total_mb === -1 ? '∞' : formatFileSize(usageSummary.limits.storage_total_mb)}
                </span>
              </div>
              <Progress 
                value={usageSummary.percentages.storage} 
                className="h-2"
              />
              <span className={`text-xs font-medium ${getUsageColor(usageSummary.percentages.storage)}`}>
                {usageSummary.percentages.storage.toFixed(1)}% used
              </span>
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Recipients
                </span>
                <span className="text-sm text-gray-500">
                  {usageSummary.current.recipients_added}
                </span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <Users className="w-3 h-3 mr-1" />
                Max {usageSummary.limits.recipients_per_drop === -1 ? '∞' : usageSummary.limits.recipients_per_drop} per drop
              </div>
            </div>
          </div>

          {/* Feature Comparison */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Plan Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  Max file size: {usageSummary.limits.file_size_mb === -1 ? 'Unlimited' : `${usageSummary.limits.file_size_mb}MB`}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  Analytics: {usageSummary.limits.analytics}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {usageSummary.limits.custom_branding ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className="text-sm">
                  Custom branding
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {usageSummary.limits.export_data ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className="text-sm">
                  Data export
                </span>
              </div>
            </div>
          </div>

          {/* Upgrade CTA for Free Users */}
          {isFreePlan && (usageSummary.percentages.drops > 80 || usageSummary.percentages.storage > 80) && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    You're approaching your limits
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Upgrade to Individual plan for 15 drops/month, 300MB files, and advanced analytics.
                  </p>
                  <Button onClick={handleUpgrade} size="sm" className="mt-3">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Billing Info for Paid Users */}
          {isPaidPlan && subscriptionData?.subscription && (
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Next Billing</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {subscriptionData.subscription.current_period_end ? 
                      new Date(subscriptionData.subscription.current_period_end).toLocaleDateString() : 
                      'Loading...'
                    }
                  </p>
                </div>
                <Button onClick={handleManageBilling} variant="outline" size="sm">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Billing Portal
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}