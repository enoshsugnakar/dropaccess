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
      // TODO: Implement actual payment integration
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

  const { title, description } = getMessage()

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(plans).map(([key, plan]) => {
            const isRecommended = key === getRecommendedPlan()
            return (
              <div
                key={key}
                className={`relative rounded-lg border p-4 ${
                  isRecommended ? 'border-primary shadow-md' : 'border-gray-200'
                }`}
              >
                {isRecommended && (
                  <Badge className="absolute -top-2 right-4" variant="default">
                    Recommended
                  </Badge>
                )}
                <div className="mb-4">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isRecommended ? 'default' : 'outline'}
                  onClick={() => handleUpgrade(key)}
                  disabled={isUpgrading}
                >
                  {isUpgrading ? 'Processing...' : 'Upgrade'}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}