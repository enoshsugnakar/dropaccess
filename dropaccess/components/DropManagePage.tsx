'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Clock,
  Users,
  Eye,
  Copy,
  Trash2,
  Download,
  ExternalLink,
  Link2,
  FileUp,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Calendar,
  Activity,
  BarChart3,
  Share2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Navbar } from '@/components/Navbar'

interface DropDetails {
  id: string
  name: string
  description?: string
  drop_type: 'file' | 'url'
  file_path?: string
  masked_url?: string
  expires_at: string
  one_time_access: boolean
  is_active: boolean
  created_at: string
  owner_id: string
}

interface Recipient {
  id: string
  email: string
  accessed_at?: string
  access_count: number
}

interface AccessLog {
  id: string
  recipient_email: string
  accessed_at: string
  ip_address?: string
  user_agent?: string
}

// Skeleton Components
function DropDetailsSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
        ))}
      </div>
    </div>
  )
}

function RecipientsSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4 animate-pulse"></div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4 animate-pulse"></div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4 animate-pulse"></div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ManagePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <DropDetailsSkeleton />
            <RecipientsSkeleton />
          </div>
          <div className="space-y-6">
            <AnalyticsSkeleton />
            <StatsSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

// Dynamic countdown hook
function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const difference = target - now

      if (difference <= 0) {
        setTimeLeft('Expired')
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

export default function DropManagePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const dropId = params.id as string

  const [loading, setLoading] = useState(true)
  const [drop, setDrop] = useState<DropDetails | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [userIsPaid, setUserIsPaid] = useState(false) // TODO: Get from user data

  const timeLeft = useCountdown(drop?.expires_at || '')

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    fetchDropDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dropId])

  const fetchDropDetails = async () => {
    try {
      // Fetch drop details
      const { data: dropData, error: dropError } = await supabase
        .from('drops')
        .select('*')
        .eq('id', dropId)
        .single()

      if (dropError) throw dropError

      // Check if user owns this drop
      if (dropData.owner_id !== user?.id) {
        toast.error('You do not have permission to view this drop')
        router.push('/dashboard')
        return
      }

      setDrop(dropData)

      // Fetch recipients
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('drop_recipients')
        .select('*')
        .eq('drop_id', dropId)
        .order('email')

      if (recipientsError) throw recipientsError
      setRecipients(recipientsData || [])

      // TODO: Fetch user subscription status
      // const { data: userData } = await supabase
      //   .from('users')
      //   .select('is_paid')
      //   .eq('id', user?.id)
      //   .single()
      // setUserIsPaid(userData?.is_paid || false)

    } catch (error) {
      console.error('Error fetching drop details:', error)
      toast.error('Failed to load drop details')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDropDetails()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  const copyDropLink = async () => {
    try {
      const link = `${window.location.origin}/drops/${dropId}`
      await navigator.clipboard.writeText(link)
      toast.success('Drop link copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  const shareDropLink = async () => {
    const link = `${window.location.origin}/drops/${dropId}`
    const shareData = {
      title: `Access: ${drop?.name}`,
      text: `You've been granted access to "${drop?.name}" via DropAccess`,
      url: link
    }

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
        toast.success('Shared successfully')
      } else {
        // Fallback to copy
        await navigator.clipboard.writeText(link)
        toast.success('Link copied to clipboard')
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        // Fallback to copy
        try {
          await navigator.clipboard.writeText(link)
          toast.success('Link copied to clipboard')
        } catch (copyErr) {
          toast.error('Failed to share link')
        }
      }
    }
  }

  const toggleDropStatus = async () => {
    if (!drop) return

    try {
      const { error } = await supabase
        .from('drops')
        .update({ is_active: !drop.is_active })
        .eq('id', dropId)

      if (error) throw error

      setDrop({ ...drop, is_active: !drop.is_active })
      toast.success(`Drop ${drop.is_active ? 'deactivated' : 'activated'}`)
    } catch (error) {
      console.error('Error updating drop status:', error)
      toast.error('Failed to update drop status')
    }
  }

  const deleteDrop = async () => {
    if (!confirm('Are you sure you want to delete this drop? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('drops')
        .delete()
        .eq('id', dropId)

      if (error) throw error

      toast.success('Drop deleted successfully')
      router.push('/dashboard')
    } catch (error) {
      console.error('Error deleting drop:', error)
      toast.error('Failed to delete drop')
    }
  }

  const getStatusInfo = () => {
    if (!drop) return { label: 'Unknown', color: 'text-gray-600 bg-gray-100' }

    const now = new Date()
    const expiresAt = new Date(drop.expires_at)

    if (!drop.is_active) return { label: 'Inactive', color: 'text-gray-600 bg-gray-100' }
    if (expiresAt < now) return { label: 'Expired', color: 'text-red-600 bg-red-100' }
    if (drop.one_time_access && recipients.some(r => r.accessed_at)) {
      return { label: 'Used', color: 'text-orange-600 bg-orange-100' }
    }
    return { label: 'Active', color: 'text-green-600 bg-green-100' }
  }

  const downloadFile = async () => {
    if (!drop || drop.drop_type !== 'file' || !drop.file_path) return

    try {
      const { data, error } = await supabase.storage
        .from('drops')
        .download(drop.file_path)

      if (error) throw error

      // Create a download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = drop.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('File downloaded successfully')
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAccessDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <ManagePageSkeleton />
  }

  if (!drop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Drop Not Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This drop does not exist or you don't have permission to view it.
            </p>
            <Button className="w-full font-medium" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const status = getStatusInfo()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-2xl font-medium text-gray-900 dark:text-white flex items-center gap-3">
                {drop.drop_type === 'file' ? (
                  <FileUp className="w-6 h-6 text-primary" />
                ) : (
                  <Link2 className="w-6 h-6 text-primary" />
                )}
                {drop.name}
              </h1>
              {drop.description && (
                <p className="mt-1 text-gray-500 dark:text-gray-400">{drop.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="font-medium"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                {status.label}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Drop Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Drop Details</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</p>
                  <p className="flex items-center gap-2 text-gray-900 dark:text-white">
                    {drop.drop_type === 'file' ? (
                      <>
                        <FileUp className="w-4 h-4" />
                        File Upload
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        Masked URL
                      </>
                    )}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</p>
                  <p className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Calendar className="w-4 h-4" />
                    {formatDate(drop.created_at)}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Expires In</p>
                  <p className="flex items-center gap-2 text-gray-900 dark:text-white font-mono">
                    <Clock className="w-4 h-4" />
                    {timeLeft}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Access Type</p>
                  <p className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Activity className="w-4 h-4" />
                    {drop.one_time_access ? 'One-time access' : 'Multiple access'}
                  </p>
                </div>
              </div>

              {drop.drop_type === 'url' && drop.masked_url && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Destination URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-white dark:bg-gray-800 rounded text-sm font-mono truncate border border-gray-200 dark:border-gray-600">
                      {drop.masked_url}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(drop.masked_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={copyDropLink} variant="outline" className="font-medium">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button onClick={shareDropLink} variant="outline" className="font-medium">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {drop.drop_type === 'file' && (
                  <Button onClick={downloadFile} variant="outline" className="font-medium">
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                )}
                <Button
                  onClick={toggleDropStatus}
                  variant={drop.is_active ? "outline" : "default"}
                  className="font-medium"
                >
                  {drop.is_active ? 'Deactivate' : 'Activate'} Drop
                </Button>
                <Button onClick={deleteDrop} variant="destructive" className="font-medium">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Recipients Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Recipients ({recipients.length})
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                People who can access this drop
              </p>
              
              {recipients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No recipients added</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 gap-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">{recipient.email}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        {recipient.accessed_at ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <div className="text-right">
                              <span className="text-xs font-medium text-green-600 block">
                                Accessed {recipient.access_count}x
                              </span>
                              <span className="text-xs text-gray-500">
                                First: {formatAccessDate(recipient.accessed_at)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">Not accessed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Analytics Button */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Analytics</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                View detailed access analytics
              </p>
              
              <Button 
                className="w-full font-medium" 
                disabled={!userIsPaid}
                onClick={() => router.push(`/drops/${dropId}/analytics`)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
                {!userIsPaid && (
                  <span className="ml-1 text-xs">(Pro)</span>
                )}
              </Button>
              
              {!userIsPaid && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Upgrade to Pro for detailed analytics
                </p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Recipients</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{recipients.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Accessed By</span>
                  <span className="font-semibold text-green-600">
                    {recipients.filter(r => r.accessed_at).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Accesses</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {recipients.reduce((sum, r) => sum + r.access_count, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Remaining</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">{timeLeft}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}