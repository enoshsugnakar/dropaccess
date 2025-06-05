'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  Clock, 
  AlertCircle, 
  Download, 
  ExternalLink, 
  Lock,
  Mail,
  Loader2,
  CheckCircle,
  FileUp,
  Link2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DropData {
  id: string
  name: string
  description?: string
  drop_type: 'file' | 'url'
  file_path?: string
  masked_url?: string
  expires_at: string
  one_time_access: boolean
  is_active: boolean
}

export default function DropAccessPage() {
  const params = useParams()
  const router = useRouter()
  const dropId = params.id as string

  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [accessing, setAccessing] = useState(false)
  const [email, setEmail] = useState('')
  const [dropData, setDropData] = useState<DropData | null>(null)
  const [error, setError] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [hasAccessed, setHasAccessed] = useState(false)

  useEffect(() => {
    if (dropId) {
      checkDropAvailability()
    }
  }, [dropId])

  const checkDropAvailability = async () => {
    try {
      // Check if drop exists and is active
      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('id', dropId)
        .single()

      if (error || !data) {
        setError('Drop not found')
        setLoading(false)
        return
      }

      // Check if drop has expired
      const now = new Date()
      const expiresAt = new Date(data.expires_at)
      if (expiresAt < now) {
        setError('This drop has expired')
        setLoading(false)
        return
      }

      // Check if drop is active
      if (!data.is_active) {
        setError('This drop is no longer active')
        setLoading(false)
        return
      }

      // Check if it's one-time access and already used
      if (data.one_time_access) {
        const { data: accessLogs, error: logsError } = await supabase
          .from('drop_access_logs')
          .select('id')
          .eq('drop_id', dropId)
          .limit(1)

        if (!logsError && accessLogs && accessLogs.length > 0) {
          setError('This drop has already been accessed (one-time access only)')
          setLoading(false)
          return
        }
      }

      setDropData(data)
      setLoading(false)
    } catch (err: any) {
      console.error('Error checking drop:', err)
      setError('An error occurred while loading the drop')
      setLoading(false)
    }
  }

  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast.error('Please enter your email')
      return
    }

    setVerifying(true)
    setError('')

    try {
      // Check if email is in recipients list
      const { data: recipient, error: recipientError } = await supabase
        .from('drop_recipients')
        .select('*')
        .eq('drop_id', dropId)
        .eq('email', email.toLowerCase().trim())
        .single()

      if (recipientError || !recipient) {
        setError('You do not have permission to access this drop')
        setVerifying(false)
        return
      }

      setIsVerified(true)
      toast.success('Email verified successfully')
    } catch (err: any) {
      console.error('Error verifying email:', err)
      setError('Failed to verify email')
    } finally {
      setVerifying(false)
    }
  }

  const accessDrop = async () => {
    if (!dropData || !isVerified) return

    setAccessing(true)
    
    try {
      // Log the access
      const { error: logError } = await supabase
        .from('drop_access_logs')
        .insert({
          drop_id: dropId,
          recipient_email: email.toLowerCase().trim(),
          ip_address: null, // Would need server-side implementation for real IP
          user_agent: navigator.userAgent
        })

      if (logError) {
        console.error('Error logging access:', logError)
      }

      // Update recipient access info
      const { data: recipient } = await supabase
        .from('drop_recipients')
        .select('*')
        .eq('drop_id', dropId)
        .eq('email', email.toLowerCase().trim())
        .single()

      if (recipient) {
        await supabase
          .from('drop_recipients')
          .update({
            accessed_at: recipient.accessed_at || new Date().toISOString(),
            access_count: (recipient.access_count || 0) + 1
          })
          .eq('id', recipient.id)
      }

      // Handle the access based on drop type
      if (dropData.drop_type === 'url' && dropData.masked_url) {
        // Redirect to the masked URL
        window.location.href = dropData.masked_url
      } else if (dropData.drop_type === 'file' && dropData.file_path) {
        // Download the file
        const { data, error } = await supabase.storage
          .from('drops')
          .download(dropData.file_path)

        if (error) throw error

        // Create download link
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = dropData.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        setHasAccessed(true)
        toast.success('File downloaded successfully')
      }
    } catch (err: any) {
      console.error('Error accessing drop:', err)
      toast.error('Failed to access drop')
    } finally {
      setAccessing(false)
    }
  }

  const getTimeRemaining = () => {
    if (!dropData) return ''
    
    const now = new Date()
    const expiresAt = new Date(dropData.expires_at)
    const diff = expiresAt.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days} days ${hours} hours`
    if (hours > 0) return `${hours} hours ${minutes} minutes`
    return `${minutes} minutes`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription className="text-base mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')} 
              className="w-full"
              variant="outline"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">Verify Your Access</CardTitle>
            <CardDescription className="text-base mt-2">
              Enter your email to access this secure drop
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verifyEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              {dropData && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{dropData.name}</strong>
                    {dropData.description && (
                      <p className="mt-1 text-sm">{dropData.description}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Verify & Continue
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (hasAccessed && dropData?.drop_type === 'file') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Download Complete</CardTitle>
            <CardDescription className="text-base mt-2">
              Your file has been downloaded successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!dropData.one_time_access && (
              <Button 
                onClick={accessDrop} 
                className="w-full mb-3"
                disabled={accessing}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Again
              </Button>
            )}
            <Button 
              onClick={() => router.push('/')} 
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            {dropData?.drop_type === 'file' ? (
              <FileUp className="w-8 h-8 text-purple-600" />
            ) : (
              <Link2 className="w-8 h-8 text-purple-600" />
            )}
          </div>
          <CardTitle className="text-2xl">{dropData?.name}</CardTitle>
          {dropData?.description && (
            <CardDescription className="text-base mt-2">
              {dropData.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Type</span>
              <span className="font-medium">
                {dropData?.drop_type === 'file' ? 'Secure File' : 'Secure Link'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Expires in</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getTimeRemaining()}
              </span>
            </div>
            {dropData?.one_time_access && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Access</span>
                <span className="font-medium text-orange-600">One-time only</span>
              </div>
            )}
          </div>

          {dropData?.one_time_access && (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                This drop can only be accessed once. After you proceed, the link will no longer work.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <span className="font-medium">Verified as:</span> {email}
            </AlertDescription>
          </Alert>

          <Button 
            onClick={accessDrop} 
            className="w-full" 
            size="lg"
            disabled={accessing}
          >
            {accessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accessing...
              </>
            ) : (
              <>
                {dropData?.drop_type === 'file' ? (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Access Link
                  </>
                )}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            By accessing this drop, you acknowledge that the sender has shared this content with you.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}