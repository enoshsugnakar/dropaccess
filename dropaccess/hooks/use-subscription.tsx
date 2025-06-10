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

// Plan limits based on your pricing image
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
        time_starts_after_verification: false
      }
    
    case 'weekly':
      return {
        plan_name: 'weekly',
        drops_per_week: 5,
        drops_per_month: 20, // Roughly 5 per week
        max_file_size_mb: 100,
        max_recipients_per_drop: 20,
        max_storage_gb: 2, // 2GB total storage
        max_access_days: 7, // Custom time limit capped at 7 days
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
        drops_per_month: 15,
        max_file_size_mb: 300,
        max_recipients_per_drop: 20,
        max_storage_gb: 5, // 5GB total storage
        max_access_days: 7, // Custom time limit capped at 7 days
        analytics_retention_days: 90,
        custom_branding: false,
        priority_support: true,
        api_access: false,
        bulk_actions: false,
        custom_domain: false,
        detailed_analytics: true,
        time_starts_after_verification: true
      }
    
    case 'business':
      return {
        plan_name: 'business',
        drops_per_month: undefined, // Unlimited
        max_file_size_mb: 1024, // 1GB per file
        max_recipients_per_drop: 500,
        max_storage_gb: 50, // 50GB total storage
        max_access_days: 30, // Custom time limit till 30 days
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
      return getPlanLimits('free')
  }
}

export function useSubscription() {
  const { user } = useAuth()
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [usage, setUsage] = useState<UsageData>({
    dropsThisMonth: 0,
    dropsThisWeek: 0,
    storageUsedMB: 0,
    recipientsThisMonth: 0
  })
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string>('free')

  useEffect(() => {
    if (user) {
      loadSubscriptionData()
    }
  }, [user])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)

      // Get user's current plan from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_paid')
        .eq('id', user?.id)
        .single()

      if (userError) {
        console.error('Error fetching user data:', userError)
      }

      // Get active subscription if exists
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Determine current plan
      let userPlan = 'free'
      if (subscriptionData) {
        userPlan = subscriptionData.plan
        setSubscription(subscriptionData)
      }

      setCurrentPlan(userPlan)
      const limits = getPlanLimits(userPlan)
      setPlanLimits(limits)

      // Calculate usage for current month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // Calculate usage for current week
      const startOfWeek = new Date()
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
      startOfWeek.setDate(diff)
      startOfWeek.setHours(0, 0, 0, 0)

      // Get drops count for this month
      const { count: dropsCountMonth } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user?.id)
        .gte('created_at', startOfMonth.toISOString())

      // Get drops count for this week
      const { count: dropsCountWeek } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user?.id)
        .gte('created_at', startOfWeek.toISOString())

      // Get total recipients this month
      const { data: recipientsData } = await supabase
        .from('drops')
        .select(`
          drop_recipients(count)
        `)
        .eq('owner_id', user?.id)
        .gte('created_at', startOfMonth.toISOString())

      const totalRecipients = recipientsData?.reduce((sum, drop: any) => {
        return sum + (drop.drop_recipients?.[0]?.count || 0)
      }, 0) || 0

      // Get storage usage (approximate)
      const { data: filesData } = await supabase
        .from('drops')
        .select('file_path')
        .eq('owner_id', user?.id)
        .eq('drop_type', 'file')
        .not('file_path', 'is', null)

      // Estimate storage (you'd want to get actual file sizes from storage)
      const storageUsedMB = (filesData?.length || 0) * 10 // Rough estimate

      setUsage({
        dropsThisMonth: dropsCountMonth || 0,
        dropsThisWeek: dropsCountWeek || 0,
        storageUsedMB,
        recipientsThisMonth: totalRecipients
      })

    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  const canCreateDrop = () => {
    if (!planLimits) return false
    
    // Check based on plan type
    if (currentPlan === 'weekly') {
      return usage.dropsThisWeek < (planLimits.drops_per_week || 0)
    } else if (currentPlan === 'business') {
      return true // Unlimited
    } else {
      // Free and monthly plans
      if (planLimits.drops_per_month === undefined) return true // Unlimited
      return usage.dropsThisMonth < planLimits.drops_per_month
    }
  }

  const getRemainingDrops = (): RemainingDrops | null => {
    if (!planLimits) return null
    
    if (currentPlan === 'weekly') {
      const total = planLimits.drops_per_week || 0
      const remaining = total - usage.dropsThisWeek
      return { 
        count: Math.max(0, remaining), 
        period: 'week',
        total
      }
    } else if (currentPlan === 'business' || planLimits.drops_per_month === undefined) {
      return null // Unlimited
    } else {
      const total = planLimits.drops_per_month
      const remaining = total - usage.dropsThisMonth
      return { 
        count: Math.max(0, remaining), 
        period: 'month',
        total
      }
    }
  }

  const getStoragePercentage = () => {
    if (!planLimits) return 0
    const limitMB = planLimits.max_storage_gb * 1024
    return Math.min(100, (usage.storageUsedMB / limitMB) * 100)
  }

  const isNearLimit = (percentage = 80) => {
    if (!planLimits) return false
    
    if (currentPlan === 'weekly') {
      if (!planLimits.drops_per_week) return false
      const usagePercentage = (usage.dropsThisWeek / planLimits.drops_per_week) * 100
      return usagePercentage >= percentage
    } else if (currentPlan === 'business' || planLimits.drops_per_month === undefined) {
      return false // Unlimited
    } else {
      const usagePercentage = (usage.dropsThisMonth / planLimits.drops_per_month) * 100
      return usagePercentage >= percentage
    }
  }

  const getPlanPrice = () => {
    switch (currentPlan) {
      case 'weekly': return '$2.99/week'
      case 'monthly': return '$9.99/month'
      case 'business': return '$19.99/month'
      default: return 'Free'
    }
  }

  return {
    planLimits,
    usage,
    subscription,
    loading,
    currentPlan,
    canCreateDrop,
    getRemainingDrops,
    getStoragePercentage,
    isNearLimit,
    getPlanPrice,
    refreshData: loadSubscriptionData
  }
}