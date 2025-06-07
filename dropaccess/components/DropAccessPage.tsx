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
  ArrowLeft,
  Timer,
  CalendarDays,
  UserCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DropData {
  id: string
  name: string
  description?: string
  drop_type: 'file' | 'url'
  file_path?: string
  masked_url?: string
  expires_at?: string
  default_time_limit_hours?: number
  global_expires_at?: string
  one_time_access: boolean
  is_active: boolean
  allow_download?: boolean
}

interface VerificationSession {
  dropId: string
  email: string
  verifiedAt: number
  expiresAt: number
  accessExpiresAt?: number
}

type ViewMode = 'verification' | 'content' | 'accessed' | 'direct-access'

const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes
const SESSION_STORAGE_KEY = 'dropaccess_verification'

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
  const [showHeader, setShowHeader] = useState(true)
  const [mouseInContent, setMouseInContent] = useState(false)
  const [personalExpiresAt, setPersonalExpiresAt] = useState<Date | null>(null)

  // Determine access type
  const getAccessType = () => {
    if (!dropData) return 'unknown'
    if (dropData.expires_at) return 'creation'
    if (dropData.default_time_limit_hours && !dropData.expires_at) return 'verification'
    return 'unknown'
  }

  // Session management functions
  const saveVerificationSession = (email: string, accessExpiresAt?: Date) => {
    const session: VerificationSession = {
      dropId,
      email,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      accessExpiresAt: accessExpiresAt?.getTime()
    }
    
    try {
      // Get existing sessions
      const existingSessions = getStoredSessions()
      
      // Remove any existing session for this drop
      const filteredSessions = existingSessions.filter(s => s.dropId !== dropId)
      
      // Add new session
      filteredSessions.push(session)
      
      // Clean up expired sessions while we're at it
      const validSessions = filteredSessions.filter(s => s.expiresAt > Date.now())
      
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validSessions))
    } catch (error) {
      console.error('Failed to save verification session:', error)
    }
  }

  const getStoredSessions = (): VerificationSession[] => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to get stored sessions:', error)
      return []
    }
  }

  const getValidSession = (): VerificationSession | null => {
    try {
      const sessions = getStoredSessions()
      const session = sessions.find(s => 
        s.dropId === dropId && 
        s.expiresAt > Date.now() &&
        (!s.accessExpiresAt || s.accessExpiresAt > Date.now())
      )
      return session || null
    } catch (error) {
      console.error('Failed to get valid session:', error)
      return null
    }
  }

  const clearSession = () => {
    try {
      const sessions = getStoredSessions()
      const filteredSessions = sessions.filter(s => s.dropId !== dropId)
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filteredSessions))
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  }

  // Check for existing session on component mount
  useEffect(() => {
    if (dropId) {
      checkDropAvailability()
    }
  }, [dropId])

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
      let targetTime: Date | null = null
      let label = ''

      if (dropData.expires_at) {
        // "After Creation" mode
        targetTime = new Date(dropData.expires_at)
        label = 'Drop expires in'
      } else if (personalExpiresAt) {
        // "After Verification" mode with personal expiry
        targetTime = personalExpiresAt
        label = 'Your access expires in'
      } else if (dropData.default_time_limit_hours) {
        // "After Verification" mode but not yet verified
        const hours = dropData.default_time_limit_hours
        if (hours < 24) {
          setTimeRemaining(`${hours} hour${hours !== 1 ? 's' : ''} after verification`)
        } else {
          const days = Math.floor(hours / 24)
          const remainingHours = hours % 24
          if (remainingHours === 0) {
            setTimeRemaining(`${days} day${days !== 1 ? 's' : ''} after verification`)
          } else {
            setTimeRemaining(`${days}d ${remainingHours}h after verification`)
          }
        }
        return
      }

      if (!targetTime) {
        setTimeRemaining('No expiry set')
        return
      }

      const diff = targetTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        setTimeRemaining('Expired')
        setError('This drop has expired')
        clearSession()
        return
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      let timeString = ''
      if (days > 0) {
        timeString = `${days}d ${hours}h ${minutes}m ${seconds}s`
      } else if (hours > 0) {
        timeString = `${hours}h ${minutes}m ${seconds}s`
      } else if (minutes > 0) {
        timeString = `${minutes}m ${seconds}s`
      } else {
        timeString = `${seconds}s`
      }
      
      setTimeRemaining(timeString)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [dropData, personalExpiresAt])

  const checkDropAvailability = async () => {
    console.log('=== DEBUG START ===')
  console.log('Current dropId from URL:', dropId)
  console.log('dropId type:', typeof dropId)
  console.log('dropId length:', dropId?.length)
    
    try {
      console.log('Making Supabase query with dropId:', dropId)
      // First, let's check if any rows exist at all
      const { data: allData, error: queryError } = await supabase
        .from('drops')
        .select('*')
        .eq('id', dropId)
        

      console.log('Drop query result:', { data: allData, error: queryError, dropId })

      if (queryError) {
        console.error('Database error:', queryError)
        setError(`Database error: ${queryError.message}`)
        setLoading(false)
        return
      }

      // Check if we have no rows
      if (!allData || allData.length === 0) {
        console.error('No drop found with ID:', dropId)
        setError('Drop not found - this link may be invalid or expired')
        setLoading(false)
        return
      }

      // Check if we have multiple rows (shouldn't happen with UUIDs)
      if (allData.length > 1) {
        console.error('Multiple drops found with same ID:', dropId, allData)
        setError('Invalid drop configuration - multiple entries found')
        setLoading(false)
        return
      }

      // We have exactly one row
      const data = allData[0]
      console.log('Drop data found:', data)

      // Check if drop is active
      if (!data.is_active) {
        setError('This drop is no longer active')
        clearSession()
        setLoading(false)
        return
      }

      // Determine access type based on what fields are set
      let accessType = 'unknown'
      if (data.expires_at) {
        accessType = 'creation' // Has fixed expiry date
      } else if (data.default_time_limit_hours && !data.expires_at) {
        accessType = 'verification' // Has time limit but no fixed expiry
      }
      
      console.log('Access type determined:', accessType, {
        expires_at: data.expires_at,
        default_time_limit_hours: data.default_time_limit_hours
      })

      // Check if drop has expired (for "After Creation" mode)
      if (accessType === 'creation' && data.expires_at) {
        const now = new Date()
        const expiresAt = new Date(data.expires_at)
        if (expiresAt < now) {
          setError('This drop has expired')
          clearSession()
          setLoading(false)
          return
        }
      }

      // Check one-time access
      if (data.one_time_access) {
        const { data: accessLogs, error: logsError } = await supabase
          .from('drop_access_logs')
          .select('id')
          .eq('drop_id', dropId)
          .limit(1)

        if (!logsError && accessLogs && accessLogs.length > 0) {
          setError('This drop has already been accessed (one-time access only)')
          clearSession()
          setLoading(false)
          return
        }
      }

      setDropData(data)
      
      if (accessType === 'creation') {
        // "After Creation" mode - direct access, no verification needed
        setViewMode('direct-access')
        setLoading(false)
        await prepareContent('direct-access')
        return
      } else if (accessType === 'verification') {
        // "After Verification" mode - check for existing session
        const existingSession = getValidSession()
        if (existingSession) {
          // Auto-verify with existing session
          setEmail(existingSession.email)
          if (existingSession.accessExpiresAt) {
            setPersonalExpiresAt(new Date(existingSession.accessExpiresAt))
          }
          setViewMode('content')
          setLoading(false)
          await prepareContent(existingSession.email)
          return
        }
        
        // Need verification
        setViewMode('verification')
        setLoading(false)
        return
      }

      // Unknown access type
      setError(`Invalid drop configuration - access type: ${accessType}`)
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

      // Update recipient verification status and calculate personal expiry
      const verifiedAt = new Date()
      let personalExpiry: Date | null = null
      
      if (dropData?.default_time_limit_hours) {
        personalExpiry = new Date(verifiedAt.getTime() + (dropData.default_time_limit_hours * 60 * 60 * 1000))
        setPersonalExpiresAt(personalExpiry)
      }

      // Update recipient in database
      await supabase
        .from('drop_recipients')
        .update({
          verified_at: verifiedAt.toISOString(),
          personal_expires_at: personalExpiry?.toISOString() || null
        })
        .eq('id', recipient.id)

      // Save verification session
      saveVerificationSession(email.toLowerCase().trim(), personalExpiry || undefined)
      
      setViewMode('content')
      toast.success('Email verified successfully')
      await prepareContent(email.toLowerCase().trim())
    } catch (err: any) {
      console.error('Error verifying email:', err)
      setError('Failed to verify email')
    } finally {
      setVerifying(false)
    }
  }

  const prepareContent = async (verifiedEmail?: string) => {
    if (!dropData) return

    const emailToUse = verifiedEmail === 'direct-access' ? 'direct-access' : (verifiedEmail || email)

    setAccessing(true)
    
    try {
      // Log the access (only if not direct access)
      if (emailToUse !== 'direct-access') {
        await supabase.from('drop_access_logs').insert({
          drop_id: dropId,
          recipient_email: emailToUse.toLowerCase().trim(),
          ip_address: null,
          user_agent: navigator.userAgent
        })

        // Update recipient access info
        const { data: recipient } = await supabase
          .from('drop_recipients')
          .select('*')
          .eq('drop_id', dropId)
          .eq('email', emailToUse.toLowerCase().trim())
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
      } else {
        // For direct access, still log it but without recipient email
        await supabase.from('drop_access_logs').insert({
          drop_id: dropId,
          recipient_email: 'direct-access',
          ip_address: null,
          user_agent: navigator.userAgent
        })
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

  const handleLogout = () => {
    clearSession()
    if (getAccessType() === 'creation') {
      // For direct access, redirect to homepage
      router.push('/')
    } else {
      // For verification mode, go back to verification
      setViewMode('verification')
      setEmail('')
      setContentUrl(null)
      setContentType('')
      setPersonalExpiresAt(null)
    }
    toast.success('Logged out successfully')
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
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-8 h-8 text-primary" />
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
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">{dropData?.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {dropData?.allow_download ? 'This file requires download to view' : 'Download is not permitted for this file'}
              </p>
              {dropData?.allow_download && (
                <Button onClick={downloadFile}>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading secure drop...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <Button 
            onClick={() => router.push('/')} 
            variant="outline"
            className="w-full font-medium"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    )
  }

  // Verification state - only for "After Verification" drops
  if (viewMode === 'verification') {
    const accessType = getAccessType()
    const AccessIcon = accessType === 'verification' ? Timer : CalendarDays

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full shadow-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-medium text-gray-900 dark:text-white mb-2">
              Verify Your Access
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Enter your email to access this secure drop
            </p>
          </div>

          {/* Drop Info Alert */}
          {dropData && (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {dropData.drop_type === 'file' ? (
                  <FileUp className="w-4 h-4 text-primary" />
                ) : (
                  <Link2 className="w-4 h-4 text-primary" />
                )}
                <h3 className="font-medium text-gray-900 dark:text-white">{dropData.name}</h3>
              </div>
              {dropData.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{dropData.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <AccessIcon className="w-3 h-3 text-blue-600" />
                  <span className="text-blue-600 font-medium">After Verification</span>
                </div>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3 text-orange-600" />
                  <span className="text-orange-600 font-medium">{timeRemaining}</span>
                </div>
              </div>
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={verifyEmail} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Email Address
              </Label>
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

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full font-medium" 
              disabled={verifying}
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Verify & Start Timer
                </>
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              🔒 This content is securely protected by DropAccess
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your personal timer starts after verification
            </p>
          </div>
        </div>
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
              onClick={handleLogout}
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
                {getAccessType() === 'verification' && email && (
                  <span className="flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {email}
                  </span>
                )}
                {getAccessType() === 'creation' && (
                  <span className="flex items-center">
                    <CalendarDays className="w-3 h-3 mr-1" />
                    Direct Access
                  </span>
                )}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:text-gray-300 hover:bg-white/10"
            >
              {getAccessType() === 'creation' ? 'Close' : 'Logout'}
            </Button>
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