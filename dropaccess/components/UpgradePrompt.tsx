// components/UpgradePrompt.tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Crown, 
  Zap, 
  ArrowRight, 
  X, 
  Check,
  TrendingUp,
  Users,
  FileUp,
  Database,
  Sparkles,
  Shield
} from 'lucide-react'
import toast from 'react-hot-toast'

interface UpgradePromptProps {
  isOpen: boolean
  onClose: () => void
  type: 'soft' | 'hard'
  title: string
  description: string
  suggestedPlan: 'individual' | 'business'
  ctaText: string
  context?: 'drops' | 'recipients' | 'file_size' | 'storage' | 'feature'
  blockingAction?: boolean // If true, user can't proceed without upgrading
}

export function UpgradePrompt({ 
  isOpen, 
  onClose, 
  type, 
  title, 
  description, 
  suggestedPlan, 
  ctaText,
  context = 'drops',
  blockingAction = false
}: UpgradePromptProps) {
  const { user } = useAuth()
  const { userTier } = useSubscription()
  const [upgrading, setUpgrading] = useState<'individual' | 'business' | null>(null)

  const handleUpgrade = async (plan: 'individual' | 'business') => {
    if (!user?.id) {
      toast.error('Please sign in to upgrade')
      return
    }

    try {
      setUpgrading(plan)
      
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          plan: plan,
          userEmail: user.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment link')
      }

      // Redirect to payment
      window.location.href = data.payment_link
      
    } catch (error: any) {
      console.error('Upgrade error:', error)
      toast.error(error.message || 'Failed to start upgrade process')
      setUpgrading(null)
    }
  }

  const getPlanFeatures = (plan: 'individual' | 'business') => {
    const features = {
      individual: {
        price: '$9.99',
        popular: true,
        features: [
          { icon: FileUp, text: '15 drops per month', highlight: context === 'drops' },
          { icon: Users, text: '20 recipients per drop', highlight: context === 'recipients' },
          { icon: Database, text: '300MB file uploads', highlight: context === 'file_size' || context === 'storage' },
          { icon: TrendingUp, text: 'Advanced analytics', highlight: context === 'feature' },
          { icon: Shield, text: 'Priority support', highlight: false },
          { icon: Sparkles, text: 'Time starts after verification', highlight: false }
        ]
      },
      business: {
        price: '$19.99',
        popular: false,
        features: [
          { icon: FileUp, text: 'Unlimited drops', highlight: context === 'drops' },
          { icon: Users, text: 'Unlimited recipients', highlight: context === 'recipients' },
          { icon: Database, text: 'Unlimited file size', highlight: context === 'file_size' || context === 'storage' },
          { icon: TrendingUp, text: 'Premium analytics', highlight: context === 'feature' },
          { icon: Crown, text: 'Custom branding', highlight: context === 'feature' },
          { icon: Shield, text: 'Team management', highlight: false }
        ]
      }
    }
    return features[plan]
  }

  const getContextIcon = () => {
    switch (context) {
      case 'drops': return FileUp
      case 'recipients': return Users
      case 'file_size': case 'storage': return Database
      case 'feature': return Sparkles
      default: return TrendingUp
    }
  }

  const ContextIcon = getContextIcon()

  return (
    <Dialog open={isOpen} onOpenChange={blockingAction ? undefined : onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${type === 'soft' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                <ContextIcon className={`w-5 h-5 ${type === 'soft' ? 'text-blue-500' : 'text-orange-500'}`} />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
                {type === 'soft' && (
                  <Badge variant="secondary" className="mt-1">Recommendation</Badge>
                )}
                {type === 'hard' && (
                  <Badge variant="destructive" className="mt-1">Action Required</Badge>
                )}
              </div>
            </div>
            {!blockingAction && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <DialogDescription className="text-base text-gray-600 dark:text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Plan Indicator */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Current Plan: {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
                </p>
                <p className="text-xs text-gray-500">
                  {userTier === 'free' ? 'Limited features' : 'Active subscription'}
                </p>
              </div>
              <Badge variant="outline">{userTier}</Badge>
            </div>
          </div>

          {/* Plan Options */}
          <div className="grid gap-4">
            {/* Suggested Plan (Primary) */}
            <Card className={`border-2 ${suggestedPlan === 'individual' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10'}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {suggestedPlan === 'individual' ? (
                      <Zap className="w-6 h-6 text-blue-500" />
                    ) : (
                      <Crown className="w-6 h-6 text-purple-500" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">
                        {suggestedPlan === 'individual' ? 'Individual Plan' : 'Business Plan'}
                      </h3>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {getPlanFeatures(suggestedPlan).price}
                        <span className="text-sm font-normal text-gray-500">/month</span>
                      </p>
                    </div>
                  </div>
                  {getPlanFeatures(suggestedPlan).popular && (
                    <Badge className="bg-blue-500 text-white">Recommended</Badge>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {getPlanFeatures(suggestedPlan).features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className={`p-1 rounded ${feature.highlight ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <feature.icon className={`w-4 h-4 ${feature.highlight ? 'text-green-600' : 'text-gray-500'}`} />
                      </div>
                      <span className={`text-sm ${feature.highlight ? 'font-medium text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {feature.text}
                      </span>
                      {feature.highlight && (
                        <Badge variant="secondary" className="text-xs">Solves your need</Badge>
                      )}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(suggestedPlan)}
                  disabled={upgrading === suggestedPlan}
                  className="w-full"
                  size="lg"
                >
                  {upgrading === suggestedPlan ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {ctaText}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Alternative Plan (if showing individual, also show business) */}
            {suggestedPlan === 'individual' && userTier === 'free' && (
              <Card className="border border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Crown className="w-6 h-6 text-purple-500" />
                      <div>
                        <h3 className="text-lg font-semibold">Business Plan</h3>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          $19.99
                          <span className="text-sm font-normal text-gray-500">/month</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">Premium</Badge>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {getPlanFeatures('business').features.slice(0, 3).map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleUpgrade('business')}
                    disabled={upgrading === 'business'}
                    variant="outline"
                    className="w-full"
                  >
                    {upgrading === 'business' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Upgrade to Business
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {!blockingAction && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              {type === 'soft' ? 'Maybe Later' : 'Cancel'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Convenience hook for showing upgrade prompts
export function useUpgradePrompt() {
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean
    type: 'soft' | 'hard'
    title: string
    description: string
    suggestedPlan: 'individual' | 'business'
    ctaText: string
    context?: 'drops' | 'recipients' | 'file_size' | 'storage' | 'feature'
    blockingAction?: boolean
  }>({
    isOpen: false,
    type: 'soft',
    title: '',
    description: '',
    suggestedPlan: 'individual',
    ctaText: '',
    context: 'drops',
    blockingAction: false
  })

  const showUpgradePrompt = (config: Omit<typeof promptConfig, 'isOpen'>) => {
    setPromptConfig({ ...config, isOpen: true })
  }

  const hideUpgradePrompt = () => {
    setPromptConfig(prev => ({ ...prev, isOpen: false }))
  }

  return {
    promptConfig,
    showUpgradePrompt,
    hideUpgradePrompt,
    UpgradePromptComponent: () => (
      <UpgradePrompt
        {...promptConfig}
        onClose={hideUpgradePrompt}
      />
    )
  }
}