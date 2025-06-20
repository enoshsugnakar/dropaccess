'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ClientAuthWrapper } from '@/components/ClientAuthWrapper'
import { Navbar } from '@/components/Navbar'
import { supabase } from '@/lib/supabaseClient'
import {
  User,
  CreditCard,
  Shield,
  Palette,
  ChevronRight,
  Loader2,
  RefreshCw,
  Crown,
  TrendingUp,
  Settings as SettingsIcon,
  Check,
  X,
  AlertTriangle,
  Users,
  Database,
  FileUp,
  Activity,
  Calendar,
  ArrowUp,
  CheckCircle2,
  Clock,
  Timer
} from 'lucide-react'
import toast from 'react-hot-toast'

type SettingsTab = 'profile' | 'subscription' | 'security' | 'customization'

interface SettingsNavItem {
  id: SettingsTab
  label: string
  icon: React.ElementType
  description: string
  requiresTier?: 'individual' | 'business'
}

interface ProfileData {
  display_name: string | null
}

// Enhanced cache configuration
const PROFILE_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes
const PROFILE_CACHE_KEY = 'settings_profile_cache'

interface ProfileCache {
  data: ProfileData
  timestamp: number
}

// Create context for profile data caching
interface SettingsContextType {
  profileData: ProfileData | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
  updateProfile: (data: Partial<ProfileData>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

function useSettingsContext() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettingsContext must be used within SettingsProvider')
  }
  return context
}

// Enhanced Settings Provider with better caching
function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Load from cache
  const loadFromCache = useCallback((): ProfileData | null => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY)
      if (cached) {
        const cacheData: ProfileCache = JSON.parse(cached)
        if (Date.now() - cacheData.timestamp < PROFILE_CACHE_DURATION) {
          return cacheData.data
        }
      }
    } catch (error) {
      console.error('Error loading profile cache:', error)
    }
    return null
  }, [])

  // Save to cache
  const saveToCache = useCallback((data: ProfileData) => {
    try {
      const cacheData: ProfileCache = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
      console.error('Error saving profile cache:', error)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setProfileLoading(true)
      
      // Check cache first
      const cachedData = loadFromCache()
      if (cachedData) {
        setProfileData(cachedData)
        setProfileLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single()

      if (error) throw error
      
      setProfileData(data)
      saveToCache(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast.error('Failed to load profile data')
    } finally {
      setProfileLoading(false)
    }
  }, [user?.id, loadFromCache, saveToCache])

  const updateProfile = useCallback(async (data: Partial<ProfileData>) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', user.id)

      if (error) throw error
      
      // Update local state and cache
      const updatedData = { ...profileData, ...data } as ProfileData
      setProfileData(updatedData)
      saveToCache(updatedData)
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    }
  }, [user?.id, profileData, saveToCache])

  // Initial load
  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const value: SettingsContextType = {
    profileData,
    profileLoading,
    refreshProfile,
    updateProfile
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

// Utility functions
function getTierBadgeColor(tier: string) {
  switch (tier) {
    case 'business':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'individual':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'free':
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600 dark:text-red-400'
  if (percentage >= 75) return 'text-orange-600 dark:text-orange-400'
  if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

function formatFileSize(sizeInMb: number): string {
  if (sizeInMb >= 1024) {
    return `${(sizeInMb / 1024).toFixed(1)} GB`
  }
  return `${sizeInMb.toFixed(1)} MB`
}

// Profile Tab Component
function ProfileTab() {
  const { user } = useAuth()
  const { profileData, profileLoading, updateProfile } = useSettingsContext()
  const [displayName, setDisplayName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (profileData?.display_name) {
      setDisplayName(profileData.display_name)
    }
  }, [profileData])

  const handleUpdateProfile = async () => {
    setIsUpdating(true)
    try {
      await updateProfile({ display_name: displayName || null })
    } finally {
      setIsUpdating(false)
    }
  }

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile & Account</CardTitle>
          <CardDescription>Manage your personal information and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile & Account</CardTitle>
        <CardDescription>Manage your personal information and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-gray-50 dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>

          <Button onClick={handleUpdateProfile} disabled={isUpdating} className="w-fit">
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              'Update Profile'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Enhanced Subscription Tab with Dashboard-style Stats
function SubscriptionTab() {
  const { user } = useAuth()
  const { usageData, userTier, loading, refreshData } = useSubscription()
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)

  const handleUpgrade = async (plan: 'individual' | 'business') => {
    if (!user) return

    setIsCreatingPayment(true)
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          userId: user.id,
          userEmail: user.email
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.payment_link) {
        window.location.href = data.payment_link
      }
    } catch (error: any) {
      console.error('Payment error:', error)
      toast.error(error.message || 'Failed to create payment link')
    } finally {
      setIsCreatingPayment(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Plans</CardTitle>
          <CardDescription>View your plan, usage, and billing information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Plan Status Skeleton */}
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usageData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Plans</CardTitle>
          <CardDescription>View your plan, usage, and billing information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Unable to load subscription data</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please try refreshing the page or contact support if the issue persists.
            </p>
            <Button onClick={refreshData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate percentages for progress bars
  const dropsPercentage = usageData.limits.drops === -1 ? 0 : (usageData.monthly.drops_created / usageData.limits.drops) * 100
  const storagePercentage = usageData.limits.storage === -1 ? 0 : (usageData.monthly.storage_used_mb / usageData.limits.storage) * 100

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription & Plans</CardTitle>
            <CardDescription>View your plan, usage, and billing information</CardDescription>
          </div>
          <Button onClick={refreshData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Current Plan Status - Dashboard Style */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h3>
            <Badge className={getTierBadgeColor(userTier)}>
              {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
            </Badge>
          </div>

          {/* Usage Stats Grid - Dashboard Style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Drops Created */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Drops Created</span>
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                {usageData.monthly.drops_created}
                {usageData.limits.drops !== -1 && (
                  <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-normal ml-1">
                    / {usageData.limits.drops}
                  </span>
                )}
              </div>
              {usageData.limits.drops !== -1 ? (
                <div className="space-y-1">
                  <Progress value={dropsPercentage} className="h-1.5" />
                  <p className="text-xs text-gray-500">
                    {Math.round(dropsPercentage)}% used
                  </p>
                </div>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400">Unlimited</p>
              )}
            </div>

            {/* Recipients Added */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Recipients</span>
                <Users className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                {usageData.monthly.recipients_added}
              </div>
              <p className="text-xs text-gray-500">
                Max {usageData.limits.recipients === -1 ? 'unlimited' : usageData.limits.recipients} per drop
              </p>
            </div>

            {/* Storage Used */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Storage</span>
                <Database className="w-3 h-3 md:w-4 md:h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                {formatFileSize(usageData.monthly.storage_used_mb)}
                {usageData.limits.storage !== -1 && (
                  <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-normal ml-1">
                    / {formatFileSize(usageData.limits.storage)}
                  </span>
                )}
              </div>
              {usageData.limits.storage !== -1 ? (
                <div className="space-y-1">
                  <Progress value={storagePercentage} className="h-1.5" />
                  <p className="text-xs text-gray-500">
                    {Math.round(storagePercentage)}% used
                  </p>
                </div>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400">Unlimited</p>
              )}
            </div>

            {/* Plan Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Status</span>
                {usageData.subscription.status === 'active' ? (
                  <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Clock className="w-3 h-3 md:w-4 md:h-4 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
              <div className={`text-lg md:text-2xl font-semibold mb-1 ${
                usageData.subscription.status === 'active' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {usageData.subscription.status === 'active' ? 'Active' : 'Inactive'}
              </div>
              <p className="text-xs text-gray-500">
                {userTier === 'free' ? 'Free Plan' : `${userTier} Plan`}
              </p>
            </div>
          </div>
        </div>

        {/* Upgrade CTA for Free Users */}
        {userTier === 'free' && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Ready to unlock more features?
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Upgrade to get more drops, larger file uploads, and advanced features.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => handleUpgrade('individual')} 
                  disabled={isCreatingPayment}
                  variant="outline"
                  className="bg-white dark:bg-gray-800"
                >
                  {isCreatingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowUp className="w-4 h-4 mr-2" />
                  )}
                  Individual - $9.99/mo
                </Button>
                <Button 
                  onClick={() => handleUpgrade('business')} 
                  disabled={isCreatingPayment}
                >
                  {isCreatingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Crown className="w-4 h-4 mr-2" />
                  )}
                  Business - $19.99/mo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Plan Details */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Plan Details</h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Drops</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {usageData.limits.drops === -1 ? 'Unlimited' : usageData.limits.drops}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Recipients per Drop</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {usageData.limits.recipients === -1 ? 'Unlimited' : usageData.limits.recipients}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Storage</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {usageData.limits.storage === -1 ? 'Unlimited' : formatFileSize(usageData.limits.storage)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Plan Type</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Billing Period Info */}
        {usageData.subscription.status === 'active' && userTier !== 'free' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">Current Billing Period</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your usage resets monthly on your billing date
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info - Development Only 
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Debug Info:</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>User ID: {user?.id}</p>
              <p>User Email: {user?.email}</p>
              <p>Current Tier: {userTier}</p>
              <p>Subscription Status: {usageData.subscription.status}</p>
            </div>
          </div>*/}
        
      </CardContent>
    </Card>
  )
}

// Security Tab Component
function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security & Privacy</CardTitle>
        <CardDescription>Password, authentication, and account security</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Security Features Coming Soon</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Advanced security settings will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Customization Tab Component
function CustomizationTab() {
  const { userTier } = useSubscription()

  if (userTier !== 'business') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customization</CardTitle>
          <CardDescription>Branding, custom domain, and white-label settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Crown className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Business Plan Required</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Customization features are available with the Business plan.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customization</CardTitle>
        <CardDescription>Branding, custom domain, and white-label settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Palette className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Customization Features Coming Soon</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Custom branding and domain settings will be available soon.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Settings Page Component
function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('subscription')
  const { userTier } = useSubscription()

  const navigationItems: SettingsNavItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      description: 'Personal information'
    },
    {
      id: 'subscription',
      label: 'Subscription',
      icon: CreditCard,
      description: 'Plans & usage'
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      description: 'Account security'
    },
    {
      id: 'customization',
      label: 'Branding',
      icon: Palette,
      description: 'Custom branding',
      requiresTier: 'business'
    }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />
      case 'subscription':
        return <SubscriptionTab />
      case 'security':
        return <SecurityTab />
      case 'customization':
        return <CustomizationTab />
      default:
        return <SubscriptionTab />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20 mt-5">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Settings
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Mobile Horizontal Navigation */}
        <div className="block lg:hidden mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1">
            <div className="flex overflow-x-auto scrollbar-hide">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                const isDisabled = item.requiresTier && userTier !== item.requiresTier
                
                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && setActiveTab(item.id)}
                    disabled={isDisabled}
                    className={`
                      flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all min-w-max
                      ${isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
                        : isDisabled
                          ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.requiresTier === 'business' && userTier !== 'business' && (
                      <Crown className="w-3 h-3 text-purple-500" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          {/* Desktop Sidebar Navigation */}
          <div className="hidden lg:block">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <nav className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  const isDisabled = item.requiresTier && userTier !== item.requiresTier

                  return (
                    <button
                      key={item.id}
                      onClick={() => !isDisabled && setActiveTab(item.id)}
                      disabled={isDisabled}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-lg text-left transition-all group
                        ${isActive 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
                          : isDisabled
                            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {item.requiresTier === 'business' && userTier !== 'business' && (
                          <Crown className="w-4 h-4 text-purple-500" />
                        )}
                        {!isDisabled && (
                          <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                        )}
                      </div>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ClientAuthWrapper requireAuth={true}>
      <SettingsProvider>
        <SettingsPageContent />
      </SettingsProvider>
    </ClientAuthWrapper>
  )
}