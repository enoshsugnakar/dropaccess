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
  Link2,
  Eye,
  FileText,
  Image,
  PlayCircle,
  Monitor,
  ArrowLeft
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
  allow_download?: boolean
}

type ViewMode = 'verification' | 'content' | 'accessed'

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
  const [viewMode, setViewMode] = useState<ViewMode>('verification')
  const [contentUrl, setContentUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [showHeader, setShowHeader] = useState(true) // Initially visible
  const [mouseInContent, setMouseInContent] = useState(false)

  // Handle mouse enter/leave for content area
  const handleContentMouseEnter = () => {
    setMouseInContent(true)
    setShowHeader(false)
  }

  const handleContentMouseLeave = () => {
    setMouseInContent(false)
    setShowHeader(true)
  }

  // Handle mouse enter for header area
  const handleHeaderMouseEnter = () => {
    setShowHeader(true)
  }

  // Dynamic countdown timer
  useEffect(() => {
    if (!dropData) return

    const updateTimer = () => {
      const now = new Date()
      const expiresAt = new Date(dropData.expires_at)
      const diff = expiresAt.getTime() - now.getTime()
      
      if (diff <= 0) {
        setTimeRemaining('Expired')
        setError('This drop has expired')
        return
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`${seconds}s`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [dropData])

  useEffect(() => {
    if (dropId) {
      checkDropAvailability()
    }
  }, [dropId])

  const checkDropAvailability = async () => {
    try {
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

      const now = new Date()
      const expiresAt = new Date(data.expires_at)
      if (expiresAt < now) {
        setError('This drop has expired')
        setLoading(false)
        return
      }

      if (!data.is_active) {
        setError('This drop is no longer active')
        setLoading(false)
        return
      }

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

      setViewMode('content')
      toast.success('Email verified successfully')
      await prepareContent()
    } catch (err: any) {
      console.error('Error verifying email:', err)
      setError('Failed to verify email')
    } finally {
      setVerifying(false)
    }
  }

  const prepareContent = async () => {
    if (!dropData) return

    setAccessing(true)
    
    try {
      // Log the access
      await supabase.from('drop_access_logs').insert({
        drop_id: dropId,
        recipient_email: email.toLowerCase().trim(),
        ip_address: null,
        user_agent: navigator.userAgent
      })

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

      if (dropData.drop_type === 'url' && dropData.masked_url) {
        await handleUrlContent(dropData.masked_url)
      } else if (dropData.drop_type === 'file' && dropData.file_path) {
        await handleFileContent(dropData.file_path)
      }
    } catch (err: any) {
      console.error('Error preparing content:', err)
      toast.error('Failed to load content')
    } finally {
      setAccessing(false)
    }
  }

  const handleUrlContent = async (url: string) => {
    const cleanUrl = url.trim()
    
    // Detect content type and set appropriate handling
    if (isGoogleDocsUrl(cleanUrl)) {
      setContentType('google-docs')
      setContentUrl(convertGoogleDocsToEmbedUrl(cleanUrl))
    } else if (isYouTubeUrl(cleanUrl)) {
      setContentType('youtube')
      setContentUrl(convertYouTubeToEmbedUrl(cleanUrl))
    } else if (isGoogleSlidesUrl(cleanUrl)) {
      setContentType('google-slides')
      setContentUrl(convertGoogleSlidesToEmbedUrl(cleanUrl))
    } else if (isGoogleSheetsUrl(cleanUrl)) {
      setContentType('google-sheets')
      setContentUrl(convertGoogleSheetsToEmbedUrl(cleanUrl))
    } else {
      // For other URLs, we'll use an iframe but with a proxy approach
      setContentType('website')
      setContentUrl(cleanUrl)
    }
  }

  const handleFileContent = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('drops')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) throw error

      const fileName = filePath.split('/').pop()?.toLowerCase() || ''
      const fileExt = fileName.split('.').pop() || ''

      setContentUrl(data.signedUrl)

      // Determine content type based on file extension
      if (['pdf'].includes(fileExt)) {
        setContentType('pdf')
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt)) {
        setContentType('image')
      } else if (['mp4', 'webm', 'ogg'].includes(fileExt)) {
        setContentType('video')
      } else if (['mp3', 'wav', 'ogg'].includes(fileExt)) {
        setContentType('audio')
      } else if (['txt', 'md', 'json', 'csv'].includes(fileExt)) {
        setContentType('text')
      } else {
        setContentType('download')
      }
    } catch (err: any) {
      console.error('Error getting file URL:', err)
      toast.error('Failed to load file')
    }
  }

  // URL detection and conversion functions
  const isGoogleDocsUrl = (url: string) => {
    return url.includes('docs.google.com/document')
  }

  const isGoogleSlidesUrl = (url: string) => {
    return url.includes('docs.google.com/presentation')
  }

  const isGoogleSheetsUrl = (url: string) => {
    return url.includes('docs.google.com/spreadsheets')
  }

  const isYouTubeUrl = (url: string) => {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/')
  }

  const convertGoogleDocsToEmbedUrl = (url: string) => {
    const docId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
    return docId ? `https://docs.google.com/document/d/${docId}/preview` : url
  }

  const convertGoogleSlidesToEmbedUrl = (url: string) => {
    const slideId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
    return slideId ? `https://docs.google.com/presentation/d/${slideId}/embed?start=false&loop=false&delayms=3000` : url
  }

  const convertGoogleSheetsToEmbedUrl = (url: string) => {
    const sheetId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
    return sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/preview` : url
  }

  const convertYouTubeToEmbedUrl = (url: string) => {
    let videoId = ''
    if (url.includes('youtube.com/watch')) {
      videoId = url.split('v=')[1]?.split('&')[0] || ''
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url
  }

  const downloadFile = async () => {
    if (!contentUrl || !dropData || !dropData.allow_download) {
      toast.error('Download is not permitted for this drop')
      return
    }

    try {
      const response = await fetch(contentUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = dropData.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('File downloaded successfully')
    } catch (err) {
      toast.error('Failed to download file')
    }
  }

  const renderContent = () => {
    if (!contentUrl) return null

    const baseClasses = "fixed inset-0 z-30 bg-white dark:bg-gray-900"

    switch (contentType) {
      case 'google-docs':
      case 'google-slides':
      case 'google-sheets':
      case 'youtube':
        return (
          <div 
            className={baseClasses}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <iframe
              src={contentUrl}
              className="w-full h-full border-0"
              allowFullScreen
              title={dropData?.name}
            />
          </div>
        )

      case 'website':
        return (
          <div 
            className={baseClasses}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <iframe
              src={contentUrl}
              className="w-full h-full border-0"
              title={dropData?.name}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        )

      case 'pdf':
        return (
          <div 
            className={baseClasses}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <iframe
              src={`${contentUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0"
              title={dropData?.name}
            />
          </div>
        )

      case 'image':
        return (
          <div 
            className={baseClasses}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <img
              src={contentUrl}
              alt={dropData?.name}
              className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800"
            />
          </div>
        )

      case 'video':
        return (
          <div 
            className={baseClasses}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <video
              src={contentUrl}
              controls
              className="w-full h-full"
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )

      case 'audio':
        return (
          <div 
            className={`${baseClasses} flex items-center justify-center`}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">{dropData?.name}</h3>
              <audio
                src={contentUrl}
                controls
                className="w-full max-w-md mx-auto"
                controlsList="nodownload"
              >
                Your browser does not support the audio tag.
              </audio>
            </div>
          </div>
        )

      case 'text':
        return (
          <div 
            className={baseClasses}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <iframe
              src={contentUrl}
              className="w-full h-full border-0"
              title={dropData?.name}
            />
          </div>
        )

      default:
        return (
          <div 
            className={`${baseClasses} flex items-center justify-center`}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">{dropData?.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {dropData?.allow_download ? 'This file requires download to view' : 'Download is not permitted for this file'}
              </p>
              {dropData?.allow_download && (
                <Button onClick={downloadFile} className="bg-purple-600 hover:bg-purple-700">
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              )}
            </div>
          </div>
        )
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  // Error state
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

  // Verification state
  if (viewMode === 'verification') {
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
                    <div className="mt-2 flex items-center text-sm">
                      <Clock className="w-3 h-3 mr-1 text-red-500" />
                      <span className="text-red-600 font-medium">
                        Expires in: {timeRemaining}
                      </span>
                    </div>
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

  // Content viewing state (fullscreen only)
  return (
    <div className="h-screen bg-black relative">
      {/* Header that appears when mouse leaves content area or hovers over header */}
      <div 
        className={`absolute top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm text-white transition-all duration-300 ${
          showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        onMouseEnter={handleHeaderMouseEnter}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('verification')}
              className="text-white hover:text-gray-300 hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {dropData?.name}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-red-400" />
                  <span className="text-red-300 font-medium">{timeRemaining}</span>
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {email}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {dropData?.drop_type === 'file' && dropData?.allow_download && (
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadFile}
                className="text-white hover:text-gray-300 hover:bg-white/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Invisible hover zone at the top to trigger header */}
      <div 
        className="absolute top-0 left-0 right-0 h-16 z-40"
        onMouseEnter={handleHeaderMouseEnter}
      />

      {/* Content */}
      <div className="h-full">
        {accessing ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading content...</p>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {/* Security notice */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs">
          🔒 Content securely hosted by DropAccess
        </div>
      </div>
    </div>
  )
}