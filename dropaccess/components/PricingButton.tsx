'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PricingButtonProps {
  plan: 'free' | 'individual' | 'business'
  planName: string
  price: string
  features: string[]
  popular?: boolean
}

export function PricingButton({ plan, planName, price, features, popular = false }: PricingButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    // Handle free plan
    if (plan === 'free') {
      if (!user) {
        router.push('/auth')
      } else {
        router.push('/dashboard')
      }
      return
    }

    // Redirect to auth if not logged in
    if (!user) {
      router.push('/auth?redirect=pricing')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: plan,
          userId: user.id,
          userEmail: user.email
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment link')
      }

      // Redirect to Dodo payment page
      if (data.payment_link) {
        window.location.href = data.payment_link
      } else {
        throw new Error('No payment link received')
      }

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const buttonClass = popular 
    ? "w-full bg-white text-primary py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
    : "w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"

  const isFree = plan === 'free'

  return (
    <div className={`${popular ? 'bg-primary' : 'bg-gray-50 dark:bg-gray-900'} rounded-xl p-6 ${popular ? 'text-white relative scale-105 shadow-xl' : 'border border-gray-200 dark:border-gray-700'}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-white text-primary px-3 py-1 rounded-full text-xs font-semibold">
            MOST POPULAR
          </div>
        </div>
      )}
      
      <div className={`text-center mb-6 ${popular ? 'pt-2' : ''}`}>
        <h3 className={`text-xl font-semibold mb-2 ${popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {planName}
        </h3>
        <div className={`text-3xl font-bold mb-2 ${popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {price}
        </div>
        <p className={`text-sm ${popular ? 'text-primary-foreground/80' : 'text-gray-600 dark:text-gray-400'}`}>
          {isFree ? 'Forever free' : 'per month'}
        </p>
      </div>
      
      <div className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${popular ? 'bg-white text-primary' : 'bg-green-600'}`}>
              <svg className="w-2 h-2 fill-current" viewBox="0 0 8 8">
                <path d="M2.3 4.1L1.7 4.7L3.5 6.5L6.9 3.1L6.3 2.5L3.5 5.3z"/>
              </svg>
            </div>
            <span className={`text-sm ${popular ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              {feature}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <Button 
        onClick={handleSubscribe}
        disabled={loading}
        className={buttonClass}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating payment link...
          </>
        ) : (
          <>
            {isFree ? (
              user ? 'Go to Dashboard' : 'Try it Out'
            ) : (
              user ? (
                <>
                  Subscribe Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              ) : (
                'Sign Up & Subscribe'
              )
            )}
          </>
        )}
      </Button>

      {!user && !isFree && (
        <p className="text-xs text-center mt-2 opacity-75">
          You'll be redirected to sign up first
        </p>
      )}
    </div>
  )
}