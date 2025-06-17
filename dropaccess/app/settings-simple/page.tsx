'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClientAuthWrapper } from '@/components/ClientAuthWrapper'
import { Navbar } from '@/components/Navbar'
import { Loader2, Crown, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SimpleSettingsPage() {
  const { user } = useAuth()
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [configCheck, setConfigCheck] = useState<any>(null)
  const [checkingConfig, setCheckingConfig] = useState(false)

  const checkConfiguration = async () => {
    setCheckingConfig(true)
    try {
      const response = await fetch('/api/debug-config')
      const config = await response.json()
      setConfigCheck(config)
      console.log('Configuration check:', config)
    } catch (error) {
      console.error('Config check failed:', error)
      toast.error('Failed to check configuration')
    } finally {
      setCheckingConfig(false)
    }
  }

  const handleUpgrade = async (planName: string) => {
    if (!user) {
      toast.error('Please log in first')
      return
    }

    try {
      setUpgrading(planName)
      
      console.log('🚀 Starting upgrade process for:', planName)
      
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: planName.toLowerCase(),
          userId: user.id,
          userEmail: user.email
        }),
      })

      console.log('📡 Payment API response status:', response.status)
      
      const data = await response.json()
      console.log('📦 Payment API response data:', data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      if (data.payment_link) {
        console.log('✅ Redirecting to payment link:', data.payment_link)
        window.location.href = data.payment_link
      } else {
        throw new Error('No payment link received from API')
      }

    } catch (err: any) {
      console.error('❌ Payment error:', err)
      toast.error(err.message || 'Something went wrong with the payment')
    } finally {
      setUpgrading(null)
    }
  }

  return (
    <ClientAuthWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Simple Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Test your upgrade functionality
            </p>
          </div>

          {/* Configuration Check */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Check if all required environment variables are set
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={checkConfiguration}
                  disabled={checkingConfig}
                  variant="outline"
                >
                  {checkingConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Check Configuration
                </Button>

                {configCheck && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span>API Key:</span>
                        <Badge variant={configCheck.hasApiKey ? "default" : "destructive"}>
                          {configCheck.hasApiKey ? "✅ Set" : "❌ Missing"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Individual Product ID:</span>
                        <Badge variant={configCheck.hasIndividualProductId ? "default" : "destructive"}>
                          {configCheck.hasIndividualProductId ? "✅ Set" : "❌ Missing"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Business Product ID:</span>
                        <Badge variant={configCheck.hasBusinessProductId ? "default" : "destructive"}>
                          {configCheck.hasBusinessProductId ? "✅ Set" : "❌ Missing"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>App URL:</span>
                        <Badge variant={configCheck.hasAppUrl ? "default" : "destructive"}>
                          {configCheck.hasAppUrl ? "✅ Set" : "❌ Missing"}
                        </Badge>
                      </div>
                    </div>
                    
                    {configCheck.appUrl !== 'not_set' && (
                      <p className="text-xs text-gray-500">
                        App URL: {configCheck.appUrl}
                      </p>
                    )}
                    
                    {(!configCheck.hasApiKey || !configCheck.hasIndividualProductId || !configCheck.hasBusinessProductId || !configCheck.hasAppUrl) && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800 mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">Missing Configuration</span>
                        </div>
                        <p className="text-red-700 text-sm">
                          Please add the missing environment variables to your Vercel project settings.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Info */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>User ID:</strong> {user?.id}</p>
                <p><strong>Email:</strong> {user?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <li>✅ 15 drops per month</li>
                    <li>✅ 300 MB file upload limit</li>
                    <li>✅ 20 recipients per drop</li>
                    <li>✅ Custom time limits</li>
                    <li>✅ Analytics & tracking</li>
                  </ul>
                  <Button 
                    onClick={() => handleUpgrade('individual')} 
                    className="w-full"
                    disabled={upgrading === 'individual'}
                  >
                    {upgrading === 'individual' ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {upgrading === 'individual' ? 'Processing...' : 'Upgrade to Individual'}
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
                    <li>✅ Unlimited drops</li>
                    <li>✅ 1 GB file upload limit</li>
                    <li>✅ 500 recipients per drop</li>
                    <li>✅ Custom branding</li>
                    <li>✅ Priority support</li>
                  </ul>
                  <Button 
                    onClick={() => handleUpgrade('business')} 
                    className="w-full"
                    disabled={upgrading === 'business'}
                  >
                    {upgrading === 'business' ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {upgrading === 'business' ? 'Processing...' : 'Upgrade to Business'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Debug Info */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
              <CardDescription>
                Check browser console for detailed logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Open browser developer tools (F12) and check the Console tab for detailed upgrade process logs.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientAuthWrapper>
  )
}