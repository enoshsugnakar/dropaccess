'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  AlertTriangle
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

// Settings Provider Component
function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setProfileLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setProfileData(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast.error('Failed to load profile data')
    } finally {
      setProfileLoading(false)
    }
  }, [user?.id])

  const updateProfile = useCallback(async (data: Partial<ProfileData>) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', user.id)

      if (error) throw error
      
      // Update local state
      setProfileData(prev => prev ? { ...prev, ...data } : data as ProfileData)
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
      throw error
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      refreshProfile()
    } else {
      setProfileLoading(false)
      setProfileData(null)
    }
  }, [user?.id, refreshProfile])

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

// Profile and Account Tab Component
function ProfileAndAccountTab() {
  const { user } = useAuth()
  const { profileData, profileLoading, updateProfile } = useSettingsContext()
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [displayName, setDisplayName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && profileData) {
      setDisplayName(profileData.display_name || user.email?.split('@')[0] || '')
    }
    
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system'
    setTheme(savedTheme)
  }, [user, profileData])

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(newTheme)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await updateProfile({ display_name: displayName })
      setIsEditing(false)
    } catch (error) {
      // Error already handled in updateProfile
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile & Account</CardTitle>
          <CardDescription>
            Manage your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading profile...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile & Account</CardTitle>
        <CardDescription>
          Manage your personal information and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Profile Information</h3>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              value={user?.email || ''} 
              disabled 
              className="bg-gray-50 dark:bg-gray-800"
            />
            <p className="text-sm text-gray-500">Your email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your display name"
              />
              {!isEditing ? (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="default" 
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false)
                      setDisplayName(profileData?.display_name || user?.email?.split('@')[0] || '')
                    }}
                    disabled={saving}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Appearance</h3>
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Subscription Tab Component
function SubscriptionTab() {
  const { usageData, subscriptionData, userTier, loading, refreshData, error } = useSubscription()
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const handleUpgrade = async (planName: string) => {
    const { user } = useAuth()
    
    try {
      setUpgrading(planName)
      
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: planName.toLowerCase(),
          userId: user!.id,
          userEmail: user!.email
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment link')
      }

      if (data.payment_link) {
        window.location.href = data.payment_link
      } else {
        throw new Error('No payment link received')
      }

    } catch (err: any) {
      console.error('Payment error:', err)
      toast.error(err.message || 'Something went wrong')
    } finally {
      setUpgrading(null)
    }
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'business': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'individual': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Plans</CardTitle>
          <CardDescription>
            View your plan, usage, and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading subscription data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Plans</CardTitle>
          <CardDescription>
            View your plan, usage, and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-center">
            <div>
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <Button onClick={refreshData} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subscription & Plans</CardTitle>
          <CardDescription>
            View your plan, usage, and billing information
          </CardDescription>
        </div>
        <Button onClick={refreshData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Current Plan</h3>
            <Badge className={getTierBadgeColor(userTier)}>
              {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
            </Badge>
          </div>
          
          {usageData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Drops Created</span>
                </div>
                <div className="text-2xl font-bold">
                  {usageData.monthly.drops_created}
                  {usageData.limits.drops !== -1 && (
                    <span className="text-sm text-gray-500 font-normal">
                      / {usageData.limits.drops}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">This month</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Recipients</span>
                </div>
                <div className="text-2xl font-bold">
                  {usageData.monthly.recipients_added}
                  {usageData.limits.recipients !== -1 && (
                    <span className="text-sm text-gray-500 font-normal">
                      / {usageData.limits.recipients}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">This month</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <SettingsIcon className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Storage Used</span>
                </div>
                <div className="text-2xl font-bold">
                  {Math.round(usageData.monthly.storage_used_mb)}
                  {usageData.limits.storage !== -1 && (
                    <span className="text-sm text-gray-500 font-normal">
                      / {usageData.limits.storage}
                    </span>
                  )}
                  <span className="text-sm text-gray-500 font-normal"> MB</span>
                </div>
                <p className="text-sm text-gray-500">Total used</p>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade Options */}
        {userTier === 'free' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Upgrade Your Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-blue-500" />
                    Individual Plan
                  </CardTitle>
                  <CardDescription>Perfect for personal use</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-3xl font-bold">$9.99<span className="text-sm font-normal">/month</span></div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        15 drops per month
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        300 MB file upload limit
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        20 recipients per drop
                      </li>
                    </ul>
                    <Button 
                      onClick={() => handleUpgrade('individual')} 
                      className="w-full"
                      disabled={upgrading === 'individual'}
                    >
                      {upgrading === 'individual' ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Upgrade to Individual
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-purple-500" />
                    Business Plan
                  </CardTitle>
                  <CardDescription>For teams and businesses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-3xl font-bold">$19.99<span className="text-sm font-normal">/month</span></div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Unlimited drops
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        1 GB file upload limit
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        500 recipients per drop
                      </li>
                    </ul>
                    <Button 
                      onClick={() => handleUpgrade('business')} 
                      className="w-full"
                      disabled={upgrading === 'business'}
                    >
                      {upgrading === 'business' ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Upgrade to Business
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Security Tab Component (placeholder)
function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security & Privacy</CardTitle>
        <CardDescription>
          Password, authentication, and account security
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 dark:text-gray-400">
          Security settings will be implemented here...
        </p>
      </CardContent>
    </Card>
  )
}

// Customization Tab Component (placeholder)
function CustomizationTab() {
  const { userTier } = useSubscription()

  if (userTier !== 'business') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customization</CardTitle>
          <CardDescription>
            Branding, custom domain, and white-label settings
          </CardDescription>
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
        <CardDescription>
          Branding, custom domain, and white-label settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 dark:text-gray-400">
          Customization settings content will go here...
        </p>
      </CardContent>
    </Card>
  )
}

// Main Settings Page Component
function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const { userTier } = useSubscription()

  const navigationItems: SettingsNavItem[] = [
    {
      id: 'profile',
      label: 'Profile & Account',
      icon: User,
      description: 'Manage your personal information and preferences'
    },
    {
      id: 'subscription',
      label: 'Subscription & Plans',
      icon: CreditCard,
      description: 'View your plan, usage, and billing information'
    },
    {
      id: 'security',
      label: 'Security & Privacy',
      icon: Shield,
      description: 'Password, authentication, and account security'
    },
    {
      id: 'customization',
      label: 'Customization',
      icon: Palette,
      description: 'Branding, custom domain, and white-label settings',
      requiresTier: 'business'
    }
  ]

  const canAccessTab = (item: SettingsNavItem): boolean => {
    if (!item.requiresTier) return true
    
    const tierOrder = { free: 0, individual: 1, business: 2 }
    const requiredLevel = tierOrder[item.requiresTier]
    const userLevel = tierOrder[userTier]
    
    return userLevel >= requiredLevel
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileAndAccountTab />
      case 'subscription':
        return <SubscriptionTab />
      case 'security':
        return <SecurityTab />
      case 'customization':
        return <CustomizationTab />
      default:
        return <ProfileAndAccountTab />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const isAccessible = canAccessTab(item)
                const Icon = item.icon
                
                return (
                  <button
                    key={item.id}
                    onClick={() => isAccessible && setActiveTab(item.id)}
                    disabled={!isAccessible}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                        : isAccessible
                        ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                        : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {item.description}
                        </div>
                      </div>
                      {!isAccessible && (
                        <Crown className="w-4 h-4 text-purple-400" />
                      )}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                )
              })}
            </nav>
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

// Main Settings Page with Providers
export default function SettingsPage() {
  return (
    <ClientAuthWrapper>
      <SettingsProvider>
        <SettingsPageContent />
      </SettingsProvider>
    </ClientAuthWrapper>
  )
}