'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'

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
  user: any
}

interface SubscriptionContextType {
  // Data
  usageData: UsageSummary | null
  subscriptionData: SubscriptionData | null
  userTier: 'free' | 'individual' | 'business'
  
  // Loading states
  loading: boolean
  
  // Error handling
  error: string | null
  
  // Actions
  refreshData: () => Promise<void>
  refreshUsage: () => Promise<void>
  refreshSubscription: () => Promise<void>
  
  // Cache info
  lastUpdated: Date | null
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null)

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  
  // State
  const [usageData, setUsageData] = useState<UsageSummary | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Derived state
  const userTier = usageData?.subscription?.tier as 'free' | 'individual' | 'business' || 'free'

  // Fetch usage data
  const refreshUsage = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/usage?userId=${user.id}`, {
        // Add cache busting to prevent stale data
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch usage data: ${response.status}`)
      }
      
      const data = await response.json()
      setUsageData(data)
      setLastUpdated(new Date())
      setError(null)
      
      console.log('📊 Usage data refreshed:', {
        tier: data.subscription.tier,
        status: data.subscription.status,
        timestamp: new Date().toISOString()
      })
      
    } catch (err) {
      console.error('Error fetching usage data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data')
    }
  }, [user?.id])

  // Fetch subscription data
  const refreshSubscription = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/payments/manage?userId=${user.id}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSubscriptionData(data)
        setError(null)
        
        console.log('💳 Subscription data refreshed:', {
          hasSubscription: data.hasSubscription,
          plan: data.subscription?.plan,
          timestamp: new Date().toISOString()
        })
      } else {
        // Not having subscription data is not an error for free users
        setSubscriptionData({ hasSubscription: false, subscription: null, user: null })
      }
      
    } catch (err) {
      console.error('Error fetching subscription data:', err)
      // Don't set error for subscription data as it's optional
      setSubscriptionData({ hasSubscription: false, subscription: null, user: null })
    }
  }, [user?.id])

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      await Promise.all([
        refreshUsage(),
        refreshSubscription()
      ])
    } catch (err) {
      console.error('Error refreshing subscription data:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh data')
    } finally {
      setLoading(false)
    }
  }, [user?.id, refreshUsage, refreshSubscription])

  // Initial data fetch
  useEffect(() => {
    if (user?.id) {
      refreshData()
    } else {
      setLoading(false)
      setUsageData(null)
      setSubscriptionData(null)
      setError(null)
    }
  }, [user?.id, refreshData])

  // Auto-refresh on focus (to catch subscription changes)
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if data is older than 30 seconds
      if (lastUpdated && Date.now() - lastUpdated.getTime() > 30000) {
        console.log('🔄 Auto-refreshing subscription data on focus')
        refreshData()
      }
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && lastUpdated && Date.now() - lastUpdated.getTime() > 30000) {
        console.log('🔄 Auto-refreshing subscription data on visibility change')
        refreshData()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [lastUpdated, refreshData])

  // Periodic refresh every 2 minutes (to catch webhook updates)
  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(() => {
      if (lastUpdated && Date.now() - lastUpdated.getTime() > 120000) { // 2 minutes
        console.log('🔄 Periodic refresh of subscription data')
        refreshUsage() // Just refresh usage, it's faster
      }
    }, 120000) // Check every 2 minutes

    return () => clearInterval(interval)
  }, [user?.id, lastUpdated, refreshUsage])

  const value: SubscriptionContextType = {
    usageData,
    subscriptionData,
    userTier,
    loading,
    error,
    refreshData,
    refreshUsage,
    refreshSubscription,
    lastUpdated
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return context
}

// Hook for just the user tier (most common use case)
export function useUserTier() {
  const { userTier, loading } = useSubscription()
  return { userTier, loading }
}

// Hook with manual refresh trigger
export function useSubscriptionWithRefresh() {
  const context = useSubscription()
  
  // Enhanced refresh that shows user feedback
  const refreshWithFeedback = useCallback(async () => {
    console.log('🔄 Manual refresh triggered')
    await context.refreshData()
  }, [context.refreshData])
  
  return {
    ...context,
    refreshWithFeedback
  }
}