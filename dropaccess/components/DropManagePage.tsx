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
  Loader2,
  RefreshCw
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

export default function DropManagePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const dropId = params.id as string

  const [loading, setLoading] = useState(true)
  const [drop, setDrop] = useState<DropDetails | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    fetchDropDetails()
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

      // Fetch access logs
      const { data: logsData, error: logsError } = await supabase
        .from('drop_access_logs')
        .select('*')
        .eq('drop_id', dropId)
        .order('accessed_at', { ascending: false })

      if (logsError) throw logsError
      setAccessLogs(logsData || [])
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

  const copyDropLink = () => {
    const link = `${window.location.origin}/drops/${dropId}`
    navigator.clipboard.writeText(link)
    toast.success('Drop link copied to clipboard')
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

  const getStatusBadge = () => {
    if (!drop) return null

    const now = new Date()
    const expiresAt = new Date(drop.expires_at)

    if (!drop.is_active) {
      return <Badge variant="secondary">Inactive</Badge>
    }
    if (expiresAt < now) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (drop.one_time_access && accessLogs.length > 0) {
      return <Badge variant="destructive">Used</Badge>
    }
    return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
  }

  const getTimeRemaining = () => {
    if (!drop) return ''
    
    const now = new Date()
    const expiresAt = new Date(drop.expires_at)
    const diff = expiresAt.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!drop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Drop Not Found</CardTitle>
            <CardDescription>This drop does not exist or you don't have permission to view it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  {drop.drop_type === 'file' ? (
                    <FileUp className="w-8 h-8 text-purple-600" />
                  ) : (
                    <Link2 className="w-8 h-8 text-purple-600" />
                  )}
                  {drop.name}
                </h1>
                {drop.description && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{drop.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                {getStatusBadge()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Drop Info Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Drop Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                      <p className="font-medium flex items-center gap-2">
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
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                      <p className="font-medium">
                        {new Date(drop.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Expires</p>
                      <p className="font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {getTimeRemaining()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Access Type</p>
                      <p className="font-medium">
                        {drop.one_time_access ? 'One-time access' : 'Multiple access'}
                      </p>
                    </div>
                  </div>

                  {drop.drop_type === 'url' && drop.masked_url && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Destination URL</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm truncate">
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

                  <div className="flex flex-wrap gap-2 pt-4">
                    <Button onClick={copyDropLink} variant="outline">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                    {drop.drop_type === 'file' && (
                      <Button onClick={downloadFile} variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download File
                      </Button>
                    )}
                    <Button
                      onClick={toggleDropStatus}
                      variant={drop.is_active ? "outline" : "default"}
                    >
                      {drop.is_active ? 'Deactivate' : 'Activate'} Drop
                    </Button>
                    <Button onClick={deleteDrop} variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recipients Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Recipients ({recipients.length})
                  </CardTitle>
                  <CardDescription>People who can access this drop</CardDescription>
                </CardHeader>
                <CardContent>
                  {recipients.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No recipients added
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">{recipient.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {recipient.accessed_at ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-xs text-gray-500">
                                  Accessed {recipient.access_count}x
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-500">Not accessed</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Access Logs */}
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Access Logs
                  </CardTitle>
                  <CardDescription>Recent access activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {accessLogs.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No access logs yet
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {accessLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-1"
                        >
                          <p className="text-sm font-medium">{log.recipient_email}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.accessed_at).toLocaleString()}
                          </p>
                          {log.ip_address && (
                            <p className="text-xs text-gray-400">IP: {log.ip_address}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Recipients</span>
                    <span className="font-medium">{recipients.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Accessed By</span>
                    <span className="font-medium">
                      {recipients.filter(r => r.accessed_at).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Accesses</span>
                    <span className="font-medium">{accessLogs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Time Remaining</span>
                    <span className="font-medium">{getTimeRemaining()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Share Link */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Share this link with recipients:
                  <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs break-all">
                    {window.location.origin}/drops/{dropId}
                  </code>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}