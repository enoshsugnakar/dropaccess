'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Shield, 
  Clock, 
  AlertCircle, 
  Mail,
  Loader2,
  CheckCircle,
  FileUp,
  Link2,
  ArrowLeft,
  Timer,
  CalendarDays,
  UserCheck,
  Volume2
} from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import toast from 'react-hot-toast'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface DropData {
  id: string
  name: string
  description?: string
  drop_type: 'file' | 'url'
  file_path?: string
  masked_url?: string
  expires_at?: string
  default_time_limit_hours?: number
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
  contentUrl?: string
  contentType?: string
  dropData?: DropData
}

type ViewMode = 'loading' | 'verification' | 'content' | 'error'

const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes
const SESSION_STORAGE_KEY = 'dropaccess_verification'

export default function DropAccessPage() {
  const params = useParams()
  const router = useRouter()
  const dropId = params.id as string

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('loading')
  const [dropData, setDropData] = useState<DropData | undefined>(undefined)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [contentUrl, setContentUrl] = useState<string | undefined>(undefined)
  const [contentType, setContentType] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [personalExpiresAt, setPersonalExpiresAt] = useState<Date | undefined>(undefined)
  const [showHeader, setShowHeader] = useState(true)

  // PDF-specific state
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)

  // Enhanced security - block right-click, copy, download
  useEffect(() => {
    const preventContext = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      return false
    }

    const preventKeys = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Ctrl+A, Ctrl+C, etc.
      if (
        e.key === 'F12' ||
        e.keyCode === 123 ||
        (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) ||
        (e.ctrlKey && [85, 83, 65, 67, 80, 83].includes(e.keyCode)) ||
        (e.metaKey && [85, 83, 65, 67, 80, 83].includes(e.keyCode))
      ) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }

    const preventSelection = (e: Event) => {
      if (viewMode === 'content') {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Comprehensive security CSS
    const style = document.createElement('style')
    style.innerHTML = `
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      
      .react-pdf__Page {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      .react-pdf__Page__textContent {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        pointer-events: none !important;
      }
      
      .react-pdf__Page__annotations {
        pointer-events: none !important;
      }
      
      canvas {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
    `
    document.head.appendChild(style)

    // Multiple layers of event prevention
    document.addEventListener('contextmenu', preventContext, { capture: true, passive: false })
    document.addEventListener('keydown', preventKeys, { capture: true, passive: false })
    document.addEventListener('selectstart', preventSelection, { capture: true, passive: false })
    document.addEventListener('dragstart', preventSelection, { capture: true, passive: false })
    document.addEventListener('copy', preventSelection, { capture: true, passive: false })
    document.addEventListener('cut', preventSelection, { capture: true, passive: false })
    document.addEventListener('paste', preventSelection, { capture: true, passive: false })
    
    window.addEventListener('contextmenu', preventContext, { capture: true, passive: false })
    window.addEventListener('keydown', preventKeys, { capture: true, passive: false })

    return () => {
      document.removeEventListener('contextmenu', preventContext, { capture: true })
      document.removeEventListener('keydown', preventKeys, { capture: true })
      document.removeEventListener('selectstart', preventSelection, { capture: true })
      document.removeEventListener('dragstart', preventSelection, { capture: true })
      document.removeEventListener('copy', preventSelection, { capture: true })
      document.removeEventListener('cut', preventSelection, { capture: true })
      document.removeEventListener('paste', preventSelection, { capture: true })
      
      window.removeEventListener('contextmenu', preventContext, { capture: true })
      window.removeEventListener('keydown', preventKeys, { capture: true })
      
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }
    }
  }, [viewMode])

  // PDF document load success handler
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setPageNumber(1)
  }

  // PDF document load error handler
  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error)
    toast.error('Failed to load PDF document')
  }

  // Session management
  const saveVerificationSession = (email: string, accessExpiresAt?: Date, contentUrl?: string, contentType?: string, dropData?: DropData) => {
    const session: VerificationSession = {
      dropId,
      email,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      accessExpiresAt: accessExpiresAt?.getTime(),
      contentUrl,
      contentType,
      dropData
    }
    
    try {
      const existingSessions = getStoredSessions()
      const filteredSessions = existingSessions.filter(s => s.dropId !== dropId)
      filteredSessions.push(session)
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
      return []
    }
  }

  const getValidSession = (): VerificationSession | null => {
    try {
      const sessions = getStoredSessions()
      return sessions.find(s => 
        s.dropId === dropId && 
        s.expiresAt > Date.now() &&
        (!s.accessExpiresAt || s.accessExpiresAt > Date.now())
      ) || null
    } catch (error) {
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

  const restoreFromCache = useCallback((session: VerificationSession) => {
    if (session.dropData) {
      setDropData(session.dropData)
    }
    if (session.contentUrl) {
      setContentUrl(session.contentUrl)
    }
    if (session.contentType) {
      setContentType(session.contentType)
    }
    if (session.accessExpiresAt) {
      setPersonalExpiresAt(new Date(session.accessExpiresAt))
    }
    setEmail(session.email)
  }, [])

  const getAccessType = () => {
    if (!dropData) return 'unknown'
    return dropData.expires_at ? 'creation' : 'verification'
  }

  const getTimerInfo = () => {
    if (!dropData) return { label: 'Loading...', description: '' }
    
    if (dropData.expires_at) {
      return {
        label: 'Shared Deadline',
        description: 'All recipients have the same deadline'
      }
    } else if (dropData.default_time_limit_hours) {
      const hours = dropData.default_time_limit_hours
      let timeString = ''
      if (hours < 24) {
        timeString = `${hours} hour${hours !== 1 ? 's' : ''}`
      } else {
        const days = Math.floor(hours / 24)
        const remainingHours = hours % 24
        timeString = remainingHours === 0 ? `${days} day${days !== 1 ? 's' : ''}` : `${days}d ${remainingHours}h`
      }
      return {
        label: `${timeString} per recipient`,
        description: 'Personal timer starts after verification'
      }
    }
    return { label: 'No time limit', description: '' }
  }

  // Timer countdown effect
  useEffect(() => {
    if (!dropData || viewMode !== 'content') return

    const updateTimer = () => {
      const now = new Date()
      let targetTime: Date | undefined = undefined

      if (dropData.expires_at) {
        targetTime = new Date(dropData.expires_at)
      } else if (personalExpiresAt) {
        targetTime = personalExpiresAt
      }

      if (!targetTime) {
        setTimeRemaining('No expiry')
        return
      }

      const diff = targetTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        setTimeRemaining('Expired')
        setError('Access has expired')
        clearSession()
        setViewMode('error')
        return
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`)
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
  }, [dropData, personalExpiresAt, viewMode])

  useEffect(() => {
    if (dropId) {
      checkDropAvailability()
    }
  }, [dropId])

  useEffect(() => {
    if (!dropData || viewMode !== 'verification') return

    const updateVerificationTimer = () => {
      if (dropData.expires_at) {
        const now = new Date()
        const expiresAt = new Date(dropData.expires_at)
        const diff = expiresAt.getTime() - now.getTime()
        
        if (diff <= 0) {
          setTimeRemaining('Expired')
          return
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        
        if (days > 0) {
          setTimeRemaining(`${days}d ${hours}h remaining`)
        } else if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m remaining`)
        } else {
          setTimeRemaining(`${minutes}m remaining`)
        }
      } else if (dropData.default_time_limit_hours) {
        const hours = dropData.default_time_limit_hours
        const timeString = hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
        setTimeRemaining(`${timeString} after verification`)
      }
    }

    updateVerificationTimer()
    const interval = setInterval(updateVerificationTimer, 60000)
    return () => clearInterval(interval)
  }, [dropData, viewMode])

  const checkDropAvailability = async () => {
    try {
      setViewMode('loading')

      const existingSession = getValidSession()
      if (existingSession) {
        restoreFromCache(existingSession)
        setViewMode('content')
        return
      }

      const { data: dropResults, error: dropError } = await supabase
        .from('drops')
        .select('*')
        .eq('id', dropId)

      if (dropError) {
        console.error('Database error:', dropError)
        setError('Failed to load drop')
        setViewMode('error')
        return
      }

      if (!dropResults || dropResults.length === 0) {
        setError('Drop not found - this link may be invalid or expired')
        setViewMode('error')
        return
      }

      const drop = dropResults[0]
      setDropData(drop)

      if (!drop.is_active) {
        setError('This drop is no longer active')
        setViewMode('error')
        return
      }

      if (drop.expires_at) {
        const now = new Date()
        const expiresAt = new Date(drop.expires_at)
        if (expiresAt < now) {
          setError('This drop has expired')
          setViewMode('error')
          return
        }
      }

      if (drop.one_time_access) {
        const { data: accessLogs } = await supabase
          .from('drop_access_logs')
          .select('id')
          .eq('drop_id', dropId)
          .limit(1)

        if (accessLogs && accessLogs.length > 0) {
          setError('This drop has already been accessed (one-time access only)')
          setViewMode('error')
          return
        }
      }

      setViewMode('verification')

    } catch (err) {
      console.error('Error checking drop:', err)
      setError('An error occurred while loading the drop')
      setViewMode('error')
    }
  }

  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toast.error('Please enter your email')
      return
    }

    setVerifying(true)

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

      const verifiedAt = new Date()
      let personalExpiry: Date | undefined = undefined
      let sessionExpiry: Date | undefined = undefined

      if (dropData?.expires_at) {
        personalExpiry = new Date(dropData.expires_at)
        sessionExpiry = personalExpiry
      } else if (dropData?.default_time_limit_hours) {
        if (!recipient.verified_at) {
          personalExpiry = new Date(verifiedAt.getTime() + (dropData.default_time_limit_hours * 60 * 60 * 1000))
          sessionExpiry = personalExpiry
        } else {
          if (recipient.personal_expires_at) {
            personalExpiry = new Date(recipient.personal_expires_at)
            sessionExpiry = personalExpiry
          } else {
            personalExpiry = new Date(verifiedAt.getTime() + (dropData.default_time_limit_hours * 60 * 60 * 1000))
            sessionExpiry = personalExpiry
          }
        }
      }

      setPersonalExpiresAt(personalExpiry)

      if (dropData?.default_time_limit_hours && !recipient.verified_at) {
        await supabase
          .from('drop_recipients')
          .update({
            verified_at: verifiedAt.toISOString(),
            personal_expires_at: personalExpiry?.toISOString() ?? undefined
          })
          .eq('id', recipient.id)
      } else if (dropData?.expires_at) {
        await supabase
          .from('drop_recipients')
          .update({
            verified_at: verifiedAt.toISOString(),
            personal_expires_at: personalExpiry?.toISOString() ?? undefined
          })
          .eq('id', recipient.id)
      }

      setViewMode('content')
      toast.success('Email verified successfully')
      await loadContent(email.toLowerCase().trim(), sessionExpiry)

    } catch (err) {
      console.error('Error verifying email:', err)
      setError('Failed to verify email')
    } finally {
      setVerifying(false)
    }
  }

  const loadContent = async (userEmail: string, sessionExpiry?: Date) => {
    setLoading(true)

    try {
      await supabase.from('drop_access_logs').insert({
        drop_id: dropId,
        recipient_email: userEmail,
        ip_address: undefined,
        user_agent: navigator.userAgent
      })

      const { data: recipient } = await supabase
        .from('drop_recipients')
        .select('*')
        .eq('drop_id', dropId)
        .eq('email', userEmail)
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

      if (dropData?.drop_type === 'url' && dropData.masked_url) {
        await handleUrlContent(dropData.masked_url)
      } else if (dropData?.drop_type === 'file' && dropData.file_path) {
        await handleFileContent(dropData.file_path)
      }

      saveVerificationSession(
        userEmail.toLowerCase().trim(), 
        sessionExpiry, 
        contentUrl, 
        contentType, 
        dropData
      )

    } catch (err) {
      console.error('Error loading content:', err)
      toast.error('Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  const handleUrlContent = async (url: string) => {
    const cleanUrl = url.trim()
    
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
      setContentType('website')
      setContentUrl(cleanUrl)
    }
  }

  const handleFileContent = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('drops')
        .createSignedUrl(filePath, 3600)

      if (error) throw error

      const fileName = filePath.split('/').pop()?.toLowerCase() || ''
      const fileExt = fileName.split('.').pop() || ''

      setContentUrl(data.signedUrl)

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
        setContentType('file')
      }
    } catch (err) {
      console.error('Error loading file:', err)
      toast.error('Failed to load file')
    }
  }

  const isGoogleDocsUrl = (url: string) => url.includes('docs.google.com/document')
  const isGoogleSlidesUrl = (url: string) => url.includes('docs.google.com/presentation')
  const isGoogleSheetsUrl = (url: string) => url.includes('docs.google.com/spreadsheets')
  const isYouTubeUrl = (url: string) => url.includes('youtube.com/watch') || url.includes('youtu.be/')

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
    return videoId ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1` : url
  }

  const handleLogout = () => {
    clearSession()
    setViewMode('verification')
    setEmail('')
    setContentUrl(undefined)
    setContentType('')
    setPersonalExpiresAt(undefined)
    setPageNumber(1)
    setNumPages(0)
  }

  const renderContent = () => {
    if (!contentUrl) return null

    const baseClasses = "fixed inset-0 z-30 bg-white dark:bg-gray-900"

    switch (contentType) {
      case 'pdf':
        return (
          <div className={baseClasses}>
            <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
              <div 
                className="flex-1 overflow-auto flex items-center justify-center p-4"
                onContextMenu={(e) => e.preventDefault()}
              >
                <Document
                  file={contentUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                      <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                    </div>
                  }
                  options={{
                    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                    cMapPacked: true
                  }}
                >
                  <Page
                    pageNumber={pageNumber}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="react-pdf__Page"
                    width={Math.min(window.innerWidth - 100, 800)}
                  />
                </Document>
              </div>
            </div>
          </div>
        )

      case 'youtube':
        return (
          <div className={baseClasses}>
            <iframe
              src={contentUrl}
              className="w-full h-full border-0"
              allowFullScreen
              title={dropData?.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        )

      case 'google-docs':
      case 'google-slides':
      case 'google-sheets':
        return (
          <div className={baseClasses}>
            <div className="relative w-full h-full">
              <iframe
                src={contentUrl}
                className="w-full h-full border-0"
                allowFullScreen
                title={dropData?.name}
              />
              <div 
                className="absolute inset-0 z-50 bg-transparent"
                onContextMenu={(e) => e.preventDefault()}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          </div>
        )

      case 'website':
        return (
          <div className={baseClasses}>
            <div className="relative w-full h-full">
              <iframe
                src={contentUrl}
                className="w-full h-full border-0"
                title={dropData?.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
              <div 
                className="absolute inset-0 z-50 bg-transparent"
                onContextMenu={(e) => e.preventDefault()}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          </div>
        )

      case 'image':
        return (
          <div className={baseClasses}>
            <img
              src={contentUrl}
              alt={dropData?.name || ''}
              className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              style={{ pointerEvents: 'none' }}
            />
          </div>
        )

      case 'video':
        return (
          <div className={baseClasses}>
            <video
              src={contentUrl}
              controls
              className="w-full h-full"
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )

      case 'audio':
        return (
          <div className={`${baseClasses} flex items-center justify-center`}>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Volume2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">{dropData?.name}</h3>
              <audio
                src={contentUrl}
                controls
                className="w-full max-w-md mx-auto"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
              >
                Your browser does not support the audio tag.
              </audio>
            </div>
          </div>
        )

      case 'text':
        return (
          <div className={baseClasses}>
            <div className="relative w-full h-full">
              <iframe
                src={contentUrl}
                className="w-full h-full border-0"
                title={dropData?.name}
              />
              <div 
                className="absolute inset-0 z-50 bg-transparent"
                onContextMenu={(e) => e.preventDefault()}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          </div>
        )

      default:
        return (
          <div className={`${baseClasses} flex items-center justify-center`}>
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">File Not Viewable</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This file type cannot be previewed for security reasons
              </p>
            </div>
          </div>
        )
    }
  }

  if (viewMode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading secure drop...</p>
        </div>
      </div>
    )
  }

  if (viewMode === 'error') {
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
            className="w-full"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    )
  }

  if (viewMode === 'verification') {
    const accessType = getAccessType()
    const timerInfo = getTimerInfo()
    const AccessIcon = accessType === 'verification' ? Timer : CalendarDays

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full shadow-lg">
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{dropData.description}</p>
              )}
              
              <div className="flex items-center gap-2 text-sm mb-2">
                <AccessIcon className="w-3 h-3 text-blue-600" />
                <span className="text-blue-600 font-medium">
                  {accessType === 'creation' ? 'Shared Deadline' : 'Personal Timer'}
                </span>
                <span className="text-gray-400">•</span>
                <Clock className="w-3 h-3 text-orange-600" />
                <span className="text-orange-600 font-medium">{timeRemaining}</span>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {timerInfo.description}
              </p>
            </div>
          )}

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
                  <UserCheck className="w-4 h-4 mr-2" />
                  Verify & Access
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              🔒 This content is securely protected by DropAccess
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-black relative">
      <div 
        className={`absolute top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm text-white transition-all duration-300 ${
          showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        onMouseEnter={() => setShowHeader(true)}
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
              <h1 className="text-lg font-semibold">{dropData?.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-red-400" />
                  <span className="text-red-300 font-medium">{timeRemaining}</span>
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {email}
                </span>
                <span className="flex items-center">
                  {getAccessType() === 'creation' ? (
                    <>
                      <CalendarDays className="w-3 h-3 mr-1" />
                      Shared Deadline
                    </>
                  ) : (
                    <>
                      <Timer className="w-3 h-3 mr-1" />
                      Personal Timer
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="absolute top-0 left-0 right-0 h-16 z-40"
        onMouseEnter={() => setShowHeader(true)}
      />

      <div 
        className="h-full"
        onMouseEnter={() => setShowHeader(false)}
        onMouseLeave={() => setShowHeader(true)}
      >
        {loading ? (
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

      {contentType !== 'pdf' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs">
            🔒 Content securely hosted by DropAccess
          </div>
        </div>
      )}
    </div>
  )
}