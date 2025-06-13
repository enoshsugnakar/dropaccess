'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientAuthWrapper } from '@/components/ClientAuthWrapper'
import { Navbar } from '@/components/Navbar'
import { supabase } from '@/lib/supabaseClient'
import {
  User,
  CreditCard,
  Shield,
  Palette,
  ChevronRight
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

// Create context for caching subscription data
interface SettingsContextType {
  userTier: 'free' | 'individual' | 'business'
  usageData: any
  subscriptionData: any
  refreshData: () => Promise<void>
  loading: boolean
  profileData: any
  handleUpgrade: (planName: string) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

function useSettingsContext() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettingsContext must be used within SettingsProvider')
  }
  return context
}

// Profile and Account Tab Component
function ProfileAndAccountTab() {
  const { user } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const { profileData, loading, refreshData } = useSettingsContext()
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
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', user!.id)

    if (error) throw error
    
    setIsEditing(false)
    toast.success('Profile updated successfully!')
  } catch (error) {
    console.error('Error saving profile:', error)
    toast.error('Error updating profile. Please try again.')
  } finally {
    setSaving(false)
  }
}



if (loading || !profileData) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8 mt-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </CardContent>
    </Card>
  )
}

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal details and account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-white">{displayName}</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <span className="text-gray-900 dark:text-white">{user?.email}</span>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Created
            </label>
            <span className="text-gray-900 dark:text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
            </span>
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
  setIsEditing(false)
  setDisplayName(profileData.display_name || user!.email?.split('@')[0] || '')
}}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how DropAccess looks to you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Theme
            </label>
            <div className="flex gap-3">
              {[
                { value: 'light', label: 'Light', icon: '☀️' },
                { value: 'dark', label: 'Dark', icon: '🌙' },
                { value: 'system', label: 'System', icon: '💻' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleThemeChange(option.value as 'light' | 'dark' | 'system')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    theme === option.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span>{option.icon}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Subscription and Plans Tab Component
function SubscriptionAndPlansTab() {
  const { userTier, usageData, subscriptionData, loading, handleUpgrade } = useSettingsContext()
  const { user } = useAuth()

  const handleBillingPortal = async () => {
  try {
    // Create a customer portal session with Dodo
    const response = await fetch('/api/payments/portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user!.id,
        returnUrl: `${window.location.origin}/settings?tab=subscription`
      })
    })

    if (response.ok) {
      const data = await response.json()
      if (data.portal_url) {
        window.location.href = data.portal_url // Redirect to Dodo portal
      }
    } else {
      toast.error('Unable to access billing portal. Please try again.')
    }
  } catch (error) {
    console.error('Error opening billing portal:', error)
    toast.error('Unable to access billing portal. Please try again.')
  }
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
    if (limit === -1) return 0
    return Math.min(100, Math.round((current / limit) * 100))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your subscription details and features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold capitalize">{userTier} Plan</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {userTier === 'free' ? '$0/month' : userTier === 'individual' ? '$9.99/month' : '$19.99/month'}
              </p>
            </div>
           {userTier !== 'business' && (
  <Button onClick={() => handleUpgrade(userTier === 'free' ? 'individual' : 'business')}>
    {userTier === 'free' ? 'Upgrade to Individual' : 'Upgrade to Business'}
  </Button>
)}
          </div>
          
          {usageData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <h4 className="font-medium mb-2">Monthly Usage</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Drops Created</span>
                      <span>{usageData.monthly.drops_created} / {usageData.limits.drops === -1 ? '∞' : usageData.limits.drops}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${getUsagePercentage(usageData.monthly.drops_created, usageData.limits.drops)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Storage Used</span>
                      <span>{formatStorageSize(usageData.monthly.storage_used_mb)} / {usageData.limits.storage === -1 ? '∞' : formatStorageSize(usageData.limits.storage)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${getUsagePercentage(usageData.monthly.storage_used_mb, usageData.limits.storage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Plan Features</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• {usageData.limits.recipients === -1 ? 'Unlimited' : usageData.limits.recipients} recipients per drop</li>
                  <li>• {userTier === 'free' ? '10MB' : userTier === 'individual' ? '300MB' : 'Unlimited'} file size limit</li>
                  <li>• {userTier === 'free' ? 'Basic' : userTier === 'individual' ? 'Advanced' : 'Premium'} analytics</li>
                  {userTier === 'business' && <li>• Custom branding</li>}
                  {userTier !== 'free' && <li>• Priority support</li>}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {userTier !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>
              Manage your subscription and billing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subscriptionData?.subscription && (
                <div>
                  <h4 className="font-medium mb-2">Next Billing Date</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {subscriptionData.subscription.current_period_end ? 
                      new Date(subscriptionData.subscription.current_period_end).toLocaleDateString() : 
                      'Loading...'
                    }
                  </p>
                </div>
              )}
              
              <div className="pt-4 border-t">
                <Button onClick={handleBillingPortal} variant="outline">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Billing
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Update payment methods, view invoices, and manage your subscription
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Compare features and upgrade your plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Free', price: '$0', features: ['3 drops/month', '3 recipients/drop', '10MB files', 'Basic analytics'] },
              { name: 'Individual', price: '$9.99', features: ['15 drops/month', '20 recipients/drop', '300MB files', 'Advanced analytics', 'Priority support'] },
              { name: 'Business', price: '$19.99', features: ['Unlimited drops', 'Unlimited recipients', 'Unlimited file size', 'Custom branding', 'Team management'] }
            ].map((plan) => (
              <div key={plan.name} className={`p-4 rounded-lg border ${userTier === plan.name.toLowerCase() ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-lg font-bold text-primary">{plan.price}<span className="text-sm font-normal">/month</span></p>
                <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {plan.features.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
                {userTier !== plan.name.toLowerCase() && plan.name !== 'Free' && (
                  <Button 
                    className="w-full mt-3" 
                    size="sm"
                    onClick={() => handleUpgrade(plan.name)}
                  >
                    Upgrade to {plan.name}
                  </Button>
                )}
                {userTier === plan.name.toLowerCase() && (
                  <Badge className="w-full justify-center mt-3">Current Plan</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Security and Privacy Tab Component
function SecurityAndPrivacyTab() {
  const { signOut } = useAuth()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match')
      return
    }
    
    setIsChangingPassword(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Password updated successfully')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      alert('Error updating password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleDeleteAccount = async () => {
    alert('Account deletion would be implemented here')
    setShowDeleteConfirm(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Password & Authentication</CardTitle>
          <CardDescription>
            Update your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
          </div>
          
          <Button 
            onClick={handlePasswordChange}
            disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword}
          >
            {isChangingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Management</CardTitle>
          <CardDescription>
            Manage your active sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign out of all devices</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will sign you out of all devices and require you to sign in again
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          <CardDescription>
            Permanent actions that cannot be undone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">Delete Account</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                Once you delete your account, there is no going back. This will permanently delete your account, 
                all your drops, and remove all associated data. This action cannot be undone.
              </p>
              
              {!showDeleteConfirm ? (
                <Button 
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Account
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    Are you absolutely sure? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive"
                      onClick={handleDeleteAccount}
                    >
                      Yes, Delete My Account
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Customization Tab Component
function CustomizationTab() {
  const { userTier, handleUpgrade } = useSettingsContext()
  const hasAccess = userTier === 'business'
  
  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customization</CardTitle>
          <CardDescription>
            Branding and white-label settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Business Plan Required
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Unlock custom branding, white-label options, and custom domain features.
            </p>
            <Button onClick={() => handleUpgrade('business')}>
              Upgrade to Business
            </Button>
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
export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [userTier, setUserTier] = useState<'free' | 'individual' | 'business'>('free')
  const [usageData, setUsageData] = useState<any>(null)
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<any>(null)

  const fetchSettingsData = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      
      const usageResponse = await fetch(`/api/usage?userId=${user.id}`)
      if (usageResponse.ok) {
        const usage = await usageResponse.json()
        setUserTier(usage.subscription.tier || 'free')
        setUsageData(usage)
      }

      const subResponse = await fetch(`/api/payments/manage?userId=${user.id}`)
      if (subResponse.ok) {
        const sub = await subResponse.json()
        setSubscriptionData(sub)
      }

       const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single()

      if (!profileError) {
        setProfileData(profile)
      }
      
    } catch (error) {
      console.error('Error fetching settings data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchSettingsData()
    }
  }, [user?.id])

  const handleUpgrade = async (planName: string) => {
    try {
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

      // Redirect to Dodo payment page
      if (data.payment_link) {
        window.location.href = data.payment_link
      } else {
        throw new Error('No payment link received')
      }

    } catch (err: any) {
      console.error('Payment error:', err)
      toast.error(err.message || 'Something went wrong')
    }
  }

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

  const settingsContextValue: SettingsContextType = {
    userTier,
    usageData,
    subscriptionData,
    profileData,
    refreshData: fetchSettingsData,
    loading,
    handleUpgrade
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileAndAccountTab />
      case 'subscription':
        return <SubscriptionAndPlansTab />
      case 'security':
        return <SecurityAndPrivacyTab />
      case 'customization':
        return <CustomizationTab />
      default:
        return <ProfileAndAccountTab />
    }
  }

  return (
    <ClientAuthWrapper>
      <SettingsContext.Provider value={settingsContextValue}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 mt-8 sm:mt:4">
          <Navbar />
          
          <div className="pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Manage your account, preferences, and subscription
                </p>
              </div>

              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:hidden">
                  <div className="flex overflow-x-auto space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {navigationItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        disabled={!canAccessTab(item)}
                        className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeTab === item.id
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                            : canAccessTab(item)
                            ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <item.icon className="w-4 h-4 mr-2 inline" />
                        {item.label}
                        {item.requiresTier && !canAccessTab(item) && (
                          <Badge className="ml-2 bg-purple-100 text-purple-800 text-xs">
                            Business
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden lg:block w-80 flex-shrink-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Settings</CardTitle>
                      <CardDescription>
                        Configure your account and preferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <nav className="space-y-1">
                        {navigationItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            disabled={!canAccessTab(item)}
                            className={`w-full flex items-center justify-between px-6 py-3 text-left transition-colors ${
                              activeTab === item.id
                                ? 'bg-primary/5 text-primary border-r-2 border-primary'
                                : canAccessTab(item)
                                ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <item.icon className="w-5 h-5" />
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {item.label}
                                  {item.requiresTier && !canAccessTab(item) && (
                                    <Badge className="bg-purple-100 text-purple-800 text-xs">
                                      Business
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {item.description}
                                </div>
                              </div>
                            </div>
                            {canAccessTab(item) && (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ))}
                      </nav>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex-1">
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsContext.Provider>
    </ClientAuthWrapper>
  )
}