'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  Volume2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  Hash
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
  pdfPages?: PDFPageData[]
}

interface PDFLink {
  url: string
  text: string
  rect: [number, number, number, number]
  pageIndex: number
  type: 'external' | 'internal' | 'email' | 'other'
}

interface PDFPageData {
  imageUrl: string
  links: PDFLink[]
  width: number
  height: number
  scale: number
}

type ViewMode = 'loading' | 'verification' | 'content' | 'error'

const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes
const SESSION_STORAGE_KEY = 'dropaccess_verification'
const PDF_CACHE_KEY = 'dropaccess_pdf_cache'

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

  // PDF specific state
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [pdfPages, setPdfPages] = useState<PDFPageData[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Links dropdown state
  const [showLinksDropdown, setShowLinksDropdown] = useState(false)
  const [allLinks, setAllLinks] = useState<PDFLink[]>([])

  // Enhanced security
  useEffect(() => {
    const preventContext = (e: Event) => {
      // Allow dropdown interactions
      const target = e.target as HTMLElement
      if (target?.closest('.pdf-links-dropdown') || target?.closest('.pdf-links-trigger')) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      return false
    }

    const preventKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        e.keyCode === 123 ||
        (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) ||
        (e.ctrlKey && [85, 83, 65, 67, 80, 83, 80].includes(e.keyCode)) ||
        (e.metaKey && [85, 83, 65, 67, 80, 83, 80].includes(e.keyCode)) ||
        (e.ctrlKey && e.key === 'p') ||
        (e.metaKey && e.key === 'p')
      ) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }

    const preventSelection = (e: Event) => {
      if (viewMode === 'content') {
        // Allow selection on dropdown
        const target = e.target as HTMLElement
        if (target?.closest('.pdf-links-dropdown') || target?.closest('.pdf-links-trigger')) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const preventPrint = () => {
      return false
    }

    // Security CSS
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
      
      input, textarea, [contenteditable="true"], .pdf-links-dropdown, .pdf-links-trigger {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }

      .pdf-page-container {
        position: relative;
        display: block;
        margin: 20px auto;
        max-width: 100%;
      }

      .pdf-page-image {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        background: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        pointer-events: none !important;
      }

      .pdf-links-trigger {
        pointer-events: auto !important;
        cursor: pointer !important;
        z-index: 100 !important;
      }

      .pdf-links-dropdown {
        pointer-events: auto !important;
        z-index: 101 !important;
      }

      .pdf-link-item {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .pdf-link-item:hover {
        background-color: rgba(59, 130, 246, 0.1) !important;
      }

      @media print {
        body { 
          display: none !important; 
        }
      }
    `
    document.head.appendChild(style)

    // Disable print
    window.addEventListener('beforeprint', preventPrint)
    window.addEventListener('afterprint', preventPrint)

    // Event listeners
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
      
      window.removeEventListener('beforeprint', preventPrint)
      window.removeEventListener('afterprint', preventPrint)
      
      window.removeEventListener('contextmenu', preventContext, { capture: true })
      window.removeEventListener('keydown', preventKeys, { capture: true })
      
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }
    }
  }, [viewMode])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target?.closest('.pdf-links-dropdown') && !target?.closest('.pdf-links-trigger')) {
        setShowLinksDropdown(false)
      }
    }

    if (showLinksDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showLinksDropdown])

  // PDF Cache Management
  const savePdfToCache = (url: string, pages: PDFPageData[]) => {
    try {
      const cacheData = {
        url,
        pages,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }
      localStorage.setItem(`${PDF_CACHE_KEY}_${dropId}`, JSON.stringify(cacheData))
      console.log('PDF pages cached successfully')
    } catch (error) {
      console.error('Failed to cache PDF:', error)
    }
  }

  const loadPdfFromCache = (url: string): PDFPageData[] | null => {
    try {
      const cached = localStorage.getItem(`${PDF_CACHE_KEY}_${dropId}`)
      if (!cached) return null

      const cacheData = JSON.parse(cached)
      
      if (cacheData.expiresAt < Date.now() || cacheData.url !== url) {
        localStorage.removeItem(`${PDF_CACHE_KEY}_${dropId}`)
        return null
      }

      console.log('PDF loaded from cache')
      return cacheData.pages
    } catch (error) {
      console.error('Failed to load PDF from cache:', error)
      return null
    }
  }

  const clearPdfCache = () => {
    try {
      localStorage.removeItem(`${PDF_CACHE_KEY}_${dropId}`)
    } catch (error) {
      console.error('Failed to clear PDF cache:', error)
    }
  }

  // Determine link type
  const getLinkType = (url: string): 'external' | 'internal' | 'email' | 'other' => {
    try {
      if (url.startsWith('mailto:')) return 'email'
      if (url.startsWith('#')) return 'internal'
      if (url.startsWith('http://') || url.startsWith('https://')) return 'external'
      return 'other'
    } catch {
      return 'other'
    }
  }

  // Get link icon
  const getLinkIcon = (type: 'external' | 'internal' | 'email' | 'other') => {
    switch (type) {
      case 'external':
        return <Globe className="w-3 h-3" />
      case 'internal':
        return <Hash className="w-3 h-3" />
      case 'email':
        return <Mail className="w-3 h-3" />
      default:
        return <FileText className="w-3 h-3" />
    }
  }

  // Truncate text smartly
  const truncateText = (text: string, maxLength: number = 25): string => {
    if (text.length <= maxLength) return text
    
    // Try to break at word boundary
    const truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...'
    }
    
    return truncated + '...'
  }

  // Extract text content from PDF for links
  const extractLinkText = async (page: any, annotation: any): Promise<string> => {
    try {
      // Get text content from the page
      const textContent = await page.getTextContent()
      const rect = annotation.rect
      
      // Find text items that overlap with the link rectangle
      const linkTexts: string[] = []
      
      textContent.items.forEach((item: any) => {
        if (item.transform && item.str) {
          // Calculate item position
          const itemX = item.transform[4]
          const itemY = item.transform[5]
          
          // Check if text item is within link bounds (with some tolerance)
          const tolerance = 5
          if (
            itemX >= rect[0] - tolerance &&
            itemX <= rect[2] + tolerance &&
            itemY >= rect[1] - tolerance &&
            itemY <= rect[3] + tolerance
          ) {
            linkTexts.push(item.str.trim())
          }
        }
      })
      
      // Combine found texts or fallback to URL
      const combinedText = linkTexts.join(' ').trim()
      return combinedText || annotation.url || 'Unknown Link'
      
    } catch (error) {
      console.error('Error extracting link text:', error)
      // Fallback: use URL as text
      return annotation.url || 'Unknown Link'
    }
  }

  // Convert PDF to images with enhanced link extraction
  const convertPdfToImages = useCallback(async (url: string, forceReload = false) => {
    setPdfError('')
    setPdfLoaded(false)
    setLoadingProgress(0)
    setAllLinks([])

    // Try to load from cache first
    if (!forceReload) {
      const cachedPages = loadPdfFromCache(url)
      if (cachedPages) {
        setPdfPages(cachedPages)
        setTotalPages(cachedPages.length)
        setPdfLoaded(true)
        setLoadingProgress(100)
        
        // Extract all links from cached pages
        const links: PDFLink[] = []
        cachedPages.forEach(page => {
          links.push(...page.links)
        })
        setAllLinks(links)
        return
      }
    }

    try {
      console.log('Converting PDF to images with enhanced link extraction for URL:', url)

      // Load PDF.js if not already loaded
      if (!(window as any).pdfjsLib) {
        console.log('Loading PDF.js library...')
        
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          script.onload = () => {
            ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            console.log('PDF.js library loaded successfully')
            resolve()
          }
          script.onerror = () => {
            console.error('Failed to load PDF.js')
            reject(new Error('Failed to load PDF.js library'))
          }
          document.head.appendChild(script)
        })
      }

      // Fetch PDF
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      console.log('PDF data received, size:', arrayBuffer.byteLength)

      // Load PDF document
      const pdf = await (window as any).pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0
      }).promise

      console.log('PDF loaded successfully. Pages:', pdf.numPages)
      setTotalPages(pdf.numPages)

      const pages: PDFPageData[] = []
      const allExtractedLinks: PDFLink[] = []

      // Convert each page to image and extract links with text
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${pdf.numPages}`)
        
        try {
          const page = await pdf.getPage(pageNum)
          
          // Create canvas for rendering
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (!context) {
            console.error(`Failed to get canvas context for page ${pageNum}`)
            continue
          }

          // Calculate scale for high quality
          const scale = 2.0
          const viewport = page.getViewport({ scale })
          
          canvas.height = viewport.height
          canvas.width = viewport.width

          // Render page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise

          // Convert canvas to image
          const imageDataUrl = canvas.toDataURL('image/png', 0.95)

          // Extract link annotations with text
          const annotations = await page.getAnnotations()
          const links: PDFLink[] = []

          for (const annotation of annotations) {
            if (annotation.subtype === 'Link' && annotation.url) {
              try {
                // Extract the actual link text
                const linkText = await extractLinkText(page, annotation)
                
                const rect = annotation.rect
                const viewportRect = viewport.convertToViewportRectangle(rect)
                
                const link: PDFLink = {
                  url: annotation.url,
                  text: linkText,
                  rect: viewportRect as [number, number, number, number],
                  pageIndex: pageNum - 1,
                  type: getLinkType(annotation.url)
                }
                
                links.push(link)
                allExtractedLinks.push(link)
                
                console.log(`Found link on page ${pageNum}: "${linkText}" -> ${annotation.url}`)
              } catch (linkError) {
                console.error(`Error processing link on page ${pageNum}:`, linkError)
              }
            }
          }

          pages.push({
            imageUrl: imageDataUrl,
            links: links,
            width: viewport.width,
            height: viewport.height,
            scale: scale
          })
          
          // Update progress
          setLoadingProgress(Math.round((pageNum / pdf.numPages) * 100))
          
          console.log(`Page ${pageNum} processed successfully with ${links.length} links`)
          
        } catch (pageError) {
          console.error(`Error processing page ${pageNum}:`, pageError)
          // Continue with other pages
        }
      }

      if (pages.length === 0) {
        throw new Error('Failed to process any pages')
      }

      // Save to cache
      savePdfToCache(url, pages)

      setPdfPages(pages)
      setAllLinks(allExtractedLinks)
      setPdfLoaded(true)
      console.log(`Successfully processed ${pages.length} pages with ${allExtractedLinks.length} total links`)

    } catch (error) {
      console.error('Error converting PDF to images:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setPdfError(`Failed to load PDF: ${errorMessage}`)
    }
  }, [dropId])

  // Handle link clicks with analytics
  const handleLinkClick = (link: PDFLink, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    try {
      console.log(`PDF link clicked: "${link.text}" -> ${link.url} (Page ${link.pageIndex + 1})`)
      
      // Validate URL
      try {
        const linkUrl = new URL(link.url.startsWith('mailto:') ? link.url : `http://${link.url.replace(/^https?:\/\//, '')}`)
        const allowedProtocols = ['http:', 'https:', 'mailto:']
        
        if (!allowedProtocols.includes(linkUrl.protocol)) {
          throw new Error('Invalid protocol')
        }
      } catch (urlError) {
        console.error('Invalid URL:', link.url)
        toast.error('Invalid link detected')
        return
      }
      
      // Open link securely
      const newWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
      if (newWindow) {
        newWindow.location.href = link.url
        toast.success(`Opened: ${truncateText(link.text, 20)}`)
        setShowLinksDropdown(false) // Close dropdown after click
      } else {
        toast.error('Popup blocked. Please allow popups for this site.')
      }
    } catch (error) {
      console.error('Error opening link:', error)
      toast.error('Failed to open link')
    }
  }

  // Trigger PDF conversion when content changes
  useEffect(() => {
    if (contentType === 'pdf' && contentUrl && viewMode === 'content') {
      console.log('Effect: Loading PDF (checking cache first):', contentUrl)
      convertPdfToImages(contentUrl)
    }
  }, [contentType, contentUrl, viewMode, convertPdfToImages])

  // Access logging
  const logAccess = async (userEmail: string, granted: boolean = true) => {
    try {
      const response = await fetch('/api/log-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drop_id: dropId,
          recipient_email: userEmail,
          access_granted: granted,
          user_agent: navigator.userAgent,
          location: null
        })
      })

      if (!response.ok) {
        console.error('Failed to log access:', await response.text())
      }
    } catch (error) {
      console.error('Error logging access:', error)
    }
  }

  // Session management
  const saveVerificationSession = (email: string, accessExpiresAt?: Date, contentUrl?: string, contentType?: string, dropData?: DropData, pdfPages?: PDFPageData[]) => {
    const session: VerificationSession = {
      dropId,
      email,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      accessExpiresAt: accessExpiresAt?.getTime(),
      contentUrl,
      contentType,
      dropData,
      pdfPages
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
      clearPdfCache()
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
    if (session.pdfPages && session.contentType === 'pdf') {
      setPdfPages(session.pdfPages)
      setTotalPages(session.pdfPages.length)
      setPdfLoaded(true)
      setLoadingProgress(100)
      
      // Extract all links from cached pages
      const links: PDFLink[] = []
      session.pdfPages.forEach(page => {
        links.push(...page.links)
      })
      setAllLinks(links)
      console.log('PDF pages and links restored from session cache')
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

      // Check for existing valid session first
      const existingSession = getValidSession()
      if (existingSession) {
        console.log('Restoring from cache...')
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
      await logAccess(email.toLowerCase().trim(), false)

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

      await logAccess(email.toLowerCase().trim(), true)

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

      await supabase
        .from('drop_recipients')
        .update({
          accessed_at: new Date().toISOString(),
          access_count: (recipient.access_count || 0) + 1
        })
        .eq('id', recipient.id)

      await loadContent()

      saveVerificationSession(
        email.toLowerCase().trim(), 
        sessionExpiry, 
        contentUrl, 
        contentType, 
        dropData,
        pdfPages
      )

      setViewMode('content')
      toast.success('Email verified successfully')

    } catch (err) {
      console.error('Error verifying email:', err)
      setError('Failed to verify email')
    } finally {
      setVerifying(false)
    }
  }

  const loadContent = async () => {
    setLoading(true)

    try {
      if (dropData?.drop_type === 'url' && dropData.masked_url) {
        await handleUrlContent(dropData.masked_url)
      } else if (dropData?.drop_type === 'file' && dropData.file_path) {
        await handleFileContent(dropData.file_path)
      }
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
    setPdfLoaded(false)
    setPdfError('')
    setPdfPages([])
    setTotalPages(0)
    setAllLinks([])
    setShowLinksDropdown(false)
  }

  const renderContent = () => {
    if (!contentUrl) return null

    const baseClasses = "fixed inset-0 z-30 bg-gray-400"

    switch (contentType) {
      case 'pdf':
        return (
          <div className={baseClasses}>
            
            {/* PDF Content */}
            <div className="relative w-full h-full overflow-auto bg-gray-400 p-4">
              {pdfError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-red-600 mb-2">PDF Loading Error</h3>
                    <p className="text-red-500 mb-4 text-sm">{pdfError}</p>
                    <div className="space-y-2">
                      <Button onClick={() => convertPdfToImages(contentUrl, false)} size="sm" className="w-full">
                        Retry from Cache
                      </Button>
                      <Button onClick={() => convertPdfToImages(contentUrl, true)} size="sm" variant="outline" className="w-full">
                        Force Reload
                      </Button>
                    </div>
                  </div>
                </div>
              ) : !pdfLoaded ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-white p-8 rounded-lg shadow-lg">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-gray-600">
                      {loadingProgress === 0 ? 'Checking cache...' : 'Converting PDF with link extraction...'}
                    </p>
                    {loadingProgress > 0 && (
                      <>
                        <p className="text-gray-400 text-sm mt-2">Progress: {loadingProgress}%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${loadingProgress}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto min-h-full relative">
                  {/* All pages - no interactive elements on PDF surface */}
                  <div className="space-y-6">
                    {pdfPages.map((pageData, index) => (
                      <div key={index} className="pdf-page-container">
                        <img
                          src={pageData.imageUrl}
                          alt={`Page ${index + 1}`}
                          className="pdf-page-image"
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                        />
                        
                        {/* Page number overlay */}
                        <div className="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none">
                          Page {index + 1} of {totalPages}
                          {pageData.links.length > 0 && (
                            <span className="ml-2 text-blue-300">
                              • {pageData.links.length} link{pageData.links.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Watermark */}
<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs pointer-events-none">
  🔒 This content is securely protected by DropAccess
</div>
                </div>
              )}
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
            <div className="w-full h-full overflow-auto p-4 flex items-center justify-center">
              <img
                src={contentUrl}
                alt={dropData?.name || ''}
                className="max-w-full max-h-full object-contain bg-white shadow-lg"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                style={{ pointerEvents: 'none' }}
              />
            </div>
          </div>
        )

      case 'video':
        return (
          <div className={baseClasses}>
            <div className="w-full h-full flex items-center justify-center p-4">
              <video
                src={contentUrl}
                controls
                className="max-w-full max-h-full"
                controlsList="nodownload nofullscreen noremoteplayback"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        )

      case 'audio':
        return (
          <div className={`${baseClasses} flex items-center justify-center`}>
            <div className="text-center bg-white p-8 rounded-lg shadow-lg">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Volume2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-4 text-gray-900">{dropData?.name}</h3>
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
            <div className="relative w-full h-full overflow-auto">
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
            <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-gray-900">File Not Viewable</h3>
              <p className="text-gray-600 mb-4">
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
      
      {/* Header overlay */}
      <div 
        className={`absolute top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm text-white transition-all duration-300 ${
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
                
                {contentType === 'pdf' && pdfLoaded && allLinks.length > 0 && (
                  <span className="flex items-center">
                    <Link2 className="w-3 h-3 mr-1" />
                    <span className="text-blue-300">
                      {allLinks.length} links
                    </span>
                  </span>
                )}
                {pdfLoaded && allLinks.length > 0 && (
              <div className="absolute top-4 mt-30 right-4 z-50">
                <div className="relative">
                  {/* Trigger Button */}
                  <button
                    className="pdf-links-trigger bg-white/95 backdrop-blur-sm border  border-gray-200 rounded-lg px-4 py-2 shadow-lg hover:bg-white transition-all duration-200 flex items-center gap-2"
                    onClick={() => setShowLinksDropdown(!showLinksDropdown)}
                  >
                    <Link2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {allLinks.length} Link{allLinks.length !== 1 ? 's' : ''}
                    </span>
                    {showLinksDropdown ? (
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    )}
                  </button>

                  {/* Dropdown Menu */}
                  {showLinksDropdown && (
                    <div className="pdf-links-dropdown absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                      <div className="p-3 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          PDF Links ({allLinks.length})
                        </h3>
                      </div>
                      
                      <div className="py-2">
                        {allLinks.map((link, index) => (
                          <button
                            key={index}
                            className="pdf-link-item w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                            onClick={(e) => handleLinkClick(link, e)}
                            title={`${link.text} - ${link.url}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 text-gray-400">
                                {getLinkIcon(link.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {truncateText(link.text, 30)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                                  <span>Pg {link.pageIndex + 1}</span>
                                  <span>•</span>
                                  <span className="truncate" style={{ maxWidth: '180px' }}>
                                    {link.url}
                                  </span>
                                </div>
                              </div>
                              <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 mt-1" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header trigger area */}
      <div 
        className="absolute top-0 left-0 right-0 h-16 z-40"
        onMouseEnter={() => setShowHeader(true)}
      />

      {/* Content */}
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