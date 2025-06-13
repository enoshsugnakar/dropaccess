'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
  CreditCard,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'

interface UsageSummary {
  monthly: {
    drops_created: number
    recipients_added: number
    storage_used_mb: number
    period_start: string
    period_end: string
  }
  weekly: {
    drops_created: number
    recipients_added: number
    storage_used_mb: number
    period_start: string
    period_end: string
  }
  limits: {
    drops: number
    recipients: number
    storage: number
  }
  subscription: {
    tier: string
    status: string
  }
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
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchSubscriptionData()
    }
  }, [user?.id])

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch usage summary from API
      const usageResponse = await fetch(`/api/usage?userId=${user!.id}`)
      if (usageResponse.ok) {
        const usage = await usageResponse.json()
        setUsageSummary(usage)
      } else {
        throw new Error('Failed to fetch usage data')
      }

      // Fetch subscription details
      const subResponse = await fetch(`/api/payments/manage?userId=${user!.id}`)
      if (subResponse.ok) {
        const data = await subResponse.json()
        setSubscriptionData(data)
      } else {
        // Not having subscription data is not an error
        setSubscriptionData({ hasSubscription: false, subscription: null })
      }

    } catch (err: unknown) {
      console.error('Error fetching subscription data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subscription data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getPlanInfo = () => {
    if (!usageSummary) return null

    const tier = usageSummary.subscription.tier || 'free'

    const planConfig = {
      free: {
        name: 'Free',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        icon: FileText,
        price: '$0/month',
        features: [
          '3 drops per month',
          '3 recipients per drop', 
          '10MB file upload limit',
          'Basic analytics'
        ]
      },
      individual: {
        name: 'Individual',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: Crown,
        price: '$9.99/month',
        features: [
          '15 drops per month',
          '20 recipients per drop',
          '300MB file limit', 
          'Advanced analytics',
          'Priority support'
        ]
      },
      business: {
        name: 'Business',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        icon: Zap,
        price: '$19.99/month',
        features: [
          'Unlimited drops',
          'Unlimited recipients',
          'Unlimited file size',
          'Custom branding',
          'Premium analytics',
          'Team management'
        ]
      }
    }

    return planConfig[tier as keyof typeof planConfig] || planConfig.free
  }

  const formatStorageSize = (sizeInMB: number): string => {
    if (sizeInMB < 1) {
      return `${Math.round(sizeInMB * 1024)} KB`
    } else if (sizeInMB < 1024) {
      return `${Math.round(sizeInMB * 10) / 10} MB`
    } else {
      return `${Math.round((sizeInMB / 1024) * 10) / 10} GB`
    }
  }

  const getUsagePercentage = (current: number, limit: number): number => {
    if (limit === -1) return 0 // Unlimited
    if (limit === 0) return 100
    return Math.min(100, Math.round((current / limit) * 100))
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const handleUpgrade = () => {
    // Scroll to pricing section on homepage
    window.location.href = '/#pricing'
  }

  const handleManageBilling = async () => {
    try {
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
      <div className="my-6">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <CardTitle>Loading Subscription...</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-6">
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
      </div>
    )
  }

  if (!usageSummary) return null

  const planInfo = getPlanInfo()
  const currentTier = usageSummary.subscription.tier || 'free'
  const isFreePlan = currentTier === 'free'
  const isPaidPlan = !isFreePlan
  const dropsPercentage = getUsagePercentage(usageSummary.monthly.drops_created, usageSummary.limits.drops)
  const storagePercentage = getUsagePercentage(usageSummary.monthly.storage_used_mb, usageSummary.limits.storage)

  return (
    <div className="my-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="w-full shadow-sm border-gray-200 dark:border-gray-700">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {planInfo && (
                    <>
                      <div className={`p-2 rounded-lg ${planInfo.color}`}>
                        <planInfo.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {planInfo.name} Plan
                          <Badge className={planInfo.color}>
                            {usageSummary.subscription.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{planInfo.price}</CardDescription>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!isPaidPlan && (
                    <Button onClick={handleUpgrade} size="sm" className="mr-2">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade
                    </Button>
                  )}
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              {/* Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Drops Usage */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium">Drops This Month</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {usageSummary.monthly.drops_created} / {usageSummary.limits.drops === -1 ? '∞' : usageSummary.limits.drops}
                    </span>
                  </div>
                  <Progress 
                    value={dropsPercentage} 
                    className="h-2"
                    indicatorClassName={getProgressColor(dropsPercentage)}
                  />
                  <p className={`text-xs font-medium ${getUsageColor(dropsPercentage)}`}>
                    {dropsPercentage}% of monthly limit used
                  </p>
                </div>

                {/* Storage Usage */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium">Storage Used</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {formatStorageSize(usageSummary.monthly.storage_used_mb)} / {usageSummary.limits.storage === -1 ? '∞' : formatStorageSize(usageSummary.limits.storage)}
                    </span>
                  </div>
                  <Progress 
                    value={storagePercentage} 
                    className="h-2"
                    indicatorClassName={getProgressColor(storagePercentage)}
                  />
                  <p className={`text-xs font-medium ${getUsageColor(storagePercentage)}`}>
                    {storagePercentage}% of storage limit used
                  </p>
                </div>
              </div>

              {/* Plan Features */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Current Plan Features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      Drops per month: {usageSummary.limits.drops === -1 ? 'Unlimited' : usageSummary.limits.drops}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      Recipients per drop: {usageSummary.limits.recipients === -1 ? 'Unlimited' : usageSummary.limits.recipients}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      File size limit: {currentTier === 'free' ? '10MB' : currentTier === 'individual' ? '300MB' : 'Unlimited'}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      Analytics: {currentTier === 'free' ? 'Basic' : currentTier === 'individual' ? 'Advanced' : 'Premium'}
                    </span>
                  </div>
                  
                  {/* Only show custom branding for business plan */}
                  {currentTier === 'business' && (
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm">
                        Custom branding
                      </span>
                    </div>
                  )}
                  
                  {/* Show priority support for paid plans */}
                  {isPaidPlan && (
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm">
                        Priority support
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upgrade Banner for Free Users */}
              {isFreePlan && (dropsPercentage > 70 || storagePercentage > 70) && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Approaching Limits
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                        You're running low on your monthly allowance. Upgrade to Individual for 15 drops/month and 300MB files.
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
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}