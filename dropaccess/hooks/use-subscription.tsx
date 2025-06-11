'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

interface PlanLimits {
  plan_name: string
  drops_per_month?: number
  drops_per_week?: number
  max_file_size_mb: number
  max_recipients_per_drop: number
  max_storage_gb: number
  max_access_hours?: number
  max_access_days?: number
  analytics_retention_days: number
  custom_branding: boolean
  priority_support: boolean
  api_access: boolean
  bulk_actions: boolean
  custom_domain: boolean
  detailed_analytics: boolean
  time_starts_after_verification: boolean
}

interface UsageData {
  dropsThisMonth: number
  dropsThisWeek: number
  storageUsedMB: number
  recipientsThisMonth: number
}

interface SubscriptionData {
  plan: string
  status: string
  expires_at?: string
  started_at?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
}

interface RemainingDrops {
  count: number
  period: 'week' | 'month'
  total: number
}

// Plan limits based on your pricing structure
const getPlanLimits = (planType: string): PlanLimits => {
  switch (planType) {
    case 'free':
      return {
        plan_name: 'free',
        drops_per_month: 2,
        max_file_size_mb: 10,
        max_recipients_per_drop: 3,
        max_storage_gb: 0.1, // 100MB total storage
        max_access_hours: 3, // 1-3 hour access time
        analytics_retention_days: 7,
        custom_branding: false,
        priority_support: false,
        api_access: false,
        bulk_actions: false,
        custom_domain: false,
        detailed_analytics: false,
        time_starts_after_verification: false // Free users can't use verification mode
      }
    
    case 'weekly':
      return {
        plan_name: 'weekly',
        drops_per_week: 10,
        drops_per_month: 40, // Roughly 10 per week
        max_file_size_mb: 25,
        max_recipients_per_drop: 10,
        max_storage_gb: 1, // 1GB total storage
        max_access_days: 7, // Up to 7 days access
        analytics_retention_days: 30,
        custom_branding: false,
        priority_support: false,
        api_access: false,
        bulk_actions: false,
        custom_domain: false,
        detailed_analytics: true,
        time_starts_after_verification: true
      }
    
    case 'monthly':
      return {
        plan_name: 'monthly',
        drops_per_month: 50,
        max_file_size_mb: 100,
        max_recipients_per_drop: 25,
        max_storage_gb: 5, // 5GB total storage
        max_access_days: 30, // Up to 30 days access
        analytics_retention_days: 90,
        custom_branding: false,
        priority_support: true,
        api_access: false,
        bulk_actions: true,
        custom_domain: false,
        detailed_analytics: true,
        time_starts_after_verification: true
      }
    
    case 'business':
      return {
        plan_name: 'business',
        drops_per_month: 200,
        max_file_size_mb: 500,
        max_recipients_per_drop: 100,
        max_storage_gb: 20, // 20GB total storage
        max_access_days: 90, // Up to 90 days access
        analytics_retention_days: 365,
        custom_branding: true,
        priority_support: true,
        api_access: true,
        bulk_actions: true,
        custom_domain: true,
        detailed_analytics: true,
        time_starts_after_verification: true
      }
    
    default:
      return getPlanLimits('free') // Default to free plan limits
  }
}

export function useSubscription() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [usage, setUsage] = useState<UsageData>({
    dropsThisMonth: 0,
    dropsThisWeek: 0,
    storageUsedMB: 0,
    recipientsThisMonth: 0
  })
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)

  useEffect(() => {
    if (!user) {
      setPlanLimits(getPlanLimits('free'))
      setIsLoading(false)
      return
    }

    fetchSubscriptionData()
  }, [user])

  const fetchSubscriptionData = async () => {
    if (!user) return

    try {
      // Fetch user's subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subError)
      }

      const planType = subData?.plan || 'free'
      setSubscription(subData)
      setPlanLimits(getPlanLimits(planType))

      // Fetch usage data
      await fetchUsageData()
    } catch (error) {
      console.error('Error in fetchSubscriptionData:', error)
      setPlanLimits(getPlanLimits('free'))
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsageData = async () => {
    if (!user) return

    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // Fetch drops created this month
      const { data: monthlyDrops, error: monthlyError } = await supabase
        .from('drops')
        .select('id')
        .eq('owner_id', user.id)
        .gte('created_at', startOfMonth.toISOString())

      if (monthlyError) throw monthlyError

      // Fetch drops created this week
      const { data: weeklyDrops, error: weeklyError } = await supabase
        .from('drops')
        .select('id')
        .eq('owner_id', user.id)
        .gte('created_at', startOfWeek.toISOString())

      if (weeklyError) throw weeklyError

      // Fetch total recipients this month
      const { data: recipientData, error: recipientError } = await supabase
        .from('drop_recipients')
        .select('id, drops!inner(owner_id, created_at)')
        .eq('drops.owner_id', user.id)
        .gte('drops.created_at', startOfMonth.toISOString())

      if (recipientError) throw recipientError

      // Calculate storage used (simplified - you might want to implement actual storage calculation)
      const { data: storageData, error: storageError } = await supabase
        .from('drops')
        .select('file_path')
        .eq('owner_id', user.id)
        .not('file_path', 'is', null)

      if (storageError) throw storageError

      setUsage({
        dropsThisMonth: monthlyDrops?.length || 0,
        dropsThisWeek: weeklyDrops?.length || 0,
        storageUsedMB: storageData?.length * 10 || 0, // Simplified calculation
        recipientsThisMonth: recipientData?.length || 0
      })
    } catch (error) {
      console.error('Error fetching usage data:', error)
    }
  }

  const getRemainingDrops = (): RemainingDrops => {
    if (!planLimits) {
      return { count: 0, period: 'month', total: 0 }
    }

    if (planLimits.drops_per_week) {
      return {
        count: Math.max(0, planLimits.drops_per_week - usage.dropsThisWeek),
        period: 'week',
        total: planLimits.drops_per_week
      }
    }

    if (planLimits.drops_per_month) {
      return {
        count: Math.max(0, planLimits.drops_per_month - usage.dropsThisMonth),
        period: 'month',
        total: planLimits.drops_per_month
      }
    }

    return { count: 0, period: 'month', total: 0 }
  }

  const canCreateDrop = (): boolean => {
    const remaining = getRemainingDrops()
    return remaining.count > 0
  }

  const getStorageUsedPercent = (): number => {
    if (!planLimits) return 0
    const maxStorageMB = planLimits.max_storage_gb * 1024
    return Math.min(100, (usage.storageUsedMB / maxStorageMB) * 100)
  }

  const refreshUsage = async () => {
    await fetchUsageData()
  }

  return {
    planLimits,
    usage,
    subscription,
    isLoading,
    canCreateDrop,
    getRemainingDrops,
    getStorageUsedPercent,
    refreshUsage
  }
}