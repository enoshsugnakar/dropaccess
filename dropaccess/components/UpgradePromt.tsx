'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap, Users, BarChart3, Shield, X } from 'lucide-react'
import { useSubscription } from '@/hooks/use-subscription'

interface UpgradePromptProps {
  trigger?: 'limit-reached' | 'feature-locked' | 'proactive'
  feature?: string
  onClose?: () => void
  className?: string
}

export function UpgradePrompt({ 
  trigger = 'proactive', 
  feature,
  onClose,
  className = ''
}: UpgradePromptProps) {
  const { planLimits, usage } = useSubscription()
  const [isUpgrading, setIsUpgrading] = useState(false)

  const plans = {
    weekly: {
      name: 'Weekly Plan',
      price: '$2.99',
      period: '/week',
      color: 'bg-blue-500',
      features: ['10 drops per week', '25MB files', '10 recipients', '7-day access']
    },
    monthly: {
      name: 'Monthly Plan', 
      price: '$9.99',
      period: '/month',
      color: 'bg-primary',
      features: ['50 drops per month', '100MB files', '25 recipients', 'Advanced analytics']
    },
    business: {
      name: 'Business Plan',
      price: '$19.99', 
      period: '/month',
      color: 'bg-purple-600',
      features: ['200 drops per month', '500MB files', '100 recipients', 'Custom branding', 'API access']
    }
  }

  const getRecommendedPlan = () => {
    if (usage.dropsThisMonth > 10 && usage.recipientsThisMonth > 10) return 'business'
    if (usage.dropsThisMonth > 3) return 'monthly'
    return 'weekly'
  }

  const handleUpgrade = async (plan: string) => {
    setIsUpgrading(true)
    try {
      // For now, just show an alert - we'll implement actual payment later
      alert(`Upgrading to ${plan} plan - Payment integration coming soon!`)
    } catch (error) {
      console.error('Upgrade error:', error)
    } finally {
      setIsUpgrading(false)
    }
  }

  const getMessage = () => {
    switch (trigger) {
      case 'limit-reached':
        return {
          title: "You've reached your limit",
          description: `You've used all ${planLimits?.drops_per_month} drops for this month. Upgrade to continue creating drops.`
        }
      case 'feature-locked':
        return {
          title: `Unlock ${feature}`,
          description: `${feature} is available on paid plans. Upgrade to access advanced features.`
        }
      default:
        return {
          title: 'Unlock more power',
          description: 'Get more drops, larger files, and advanced features with a paid plan.'
        }
    }
  }

  const message = getMessage()
  const recommendedPlan = getRecommendedPlan()

  return (
    <Card className={`border-2 border-primary/20 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{message.title}</CardTitle>
              <CardDescription className="mt-1">
                {message.description}
              </CardDescription>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Usage */}
        {planLimits && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Current Usage
            </div>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Drops this month</span>
                <span>{usage.dropsThisMonth} / {planLimits.drops_per_month || '∞'}</span>
              </div>
              <div className="flex justify-between">
                <span>Recipients</span>
                <span>{usage.recipientsThisMonth}</span>
              </div>
              <div className="flex justify-between">
                <span>Storage used</span>
                <span>{usage.storageUsedMB}MB / {planLimits.max_storage_gb}GB</span>
              </div>
            </div>
          </div>
        )}

        {/* Plan Options */}
        <div className="grid gap-3">
          {Object.entries(plans).map(([key, plan]) => (
            <div
              key={key}
              className={`border rounded-lg p-4 ${
                key === recommendedPlan ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {plan.name}
                  </span>
                  {key === recommendedPlan && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {plan.period}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {plan.features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                  >
                    {feature}
                  </span>
                ))}
              </div>
              <Button
                onClick={() => handleUpgrade(key)}
                disabled={isUpgrading}
                className={`w-full ${key === recommendedPlan ? '' : 'variant-outline'}`}
                variant={key === recommendedPlan ? 'default' : 'outline'}
              >
                {isUpgrading ? 'Processing...' : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}