'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/hooks/use-subscription'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/Navbar'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Link2,
  FileUp,
  Clock,
  Users,
  Eye,
  Search,
  MoreVertical,
  Copy,
  Trash2,
  Download,
  Settings,
  Shield,
  TrendingUp,
  Calendar,
  Filter,
  Grid3X3,
  List,
  ChevronRight,
  Activity,
  RefreshCw,
  Timer,
  CalendarDays,
  AlertCircle,
  Crown
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Drop {
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
  created_at: string
  recipient_count?: number
  access_count?: number
}

// Cache management
interface CacheData {
  drops: Drop[]
  stats: {
    totalDrops: number
    activeDrops: number
    totalAccesses: number
    totalRecipients: number
  }
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const CACHE_KEY = 'dashboard_data'

// Skeleton Components
function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
    </div>
  )
}

function DropCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1 animate-pulse"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
          </div>
        </div>
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
      
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-4 animate-pulse"></div>
      
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4 animate-pulse"></div>

      <div className="space-y-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
          </div>
        ))}
      </div>

      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3 animate-pulse"></div>
          <div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1 animate-pulse"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </td>
    </tr>
  )
}

function DashboardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-6 h-6 text-primary" />
                <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-32 animate-pulse"></div>
          </div>
        </div>

        {/* Stats Skeleton - 2x2 on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Controls Skeleton */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-40 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <DropCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Drop', 'Status', 'Recipients', 'Views', 'Expires', 'Actions'].map((header) => (
                      <th key={header} className="px-6 py-3 text-left">
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Custom Dropdown Component
interface CustomDropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
}

function CustomDropdown({ trigger, children }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div className="absolute right-0 top-8 w-44 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-50 py-1">
          <div onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
}

function DropdownItem({ onClick, children, className = '' }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

function DropdownSeparator() {
  return <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [drops, setDrops] = useState<Drop[]>([])
  const [filteredDrops, setFilteredDrops] = useState<Drop[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'inactive'>('all')
  const [lastFetch, setLastFetch] = useState<number>(0)
  const [stats, setStats] = useState({
    totalDrops: 0,
    activeDrops: 0,
    totalAccesses: 0,
    totalRecipients: 0
  })

  // Get subscription data
  const { 
    planLimits, 
    usage, 
    currentPlan, 
    canCreateDrop, 
    getRemainingDrops, 
    getStoragePercentage, 
    isNearLimit,
    getPlanPrice,
    loading: subscriptionLoading 
  } = useSubscription()

  const remainingDrops = getRemainingDrops()

  // Check if data is cached and still valid
  const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION
  }

  // Load data from cache if available
  const loadFromCache = (): CacheData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const data: CacheData = JSON.parse(cached)
        if (isCacheValid(data.timestamp)) {
          return data
        }
      }
    } catch (error) {
      console.error('Error loading cache:', error)
    }
    return null
  }

  // Save data to cache
  const saveToCache = (drops: Drop[], stats: any) => {
    try {
      const cacheData: CacheData = {
        drops,
        stats,
        timestamp: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
      console.error('Error saving cache:', error)
    }
  }

  // Clear cache
  const clearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY)
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }

  // Determine access model
  const getAccessModel = (drop: Drop) => {
    if (drop.expires_at) {
      return {
        type: 'creation',
        label: 'Shared Deadline',
        icon: CalendarDays,
        description: 'All recipients have the same deadline'
      }
    } else if (drop.default_time_limit_hours) {
      return {
        type: 'verification',
        label: 'Personal Timers',
        icon: Timer,
        description: 'Timer starts after email verification'
      }
    }
    return {
      type: 'none',
      label: 'No Expiry',
      icon: Clock,
      description: 'Permanent access'
    }
  }

  // Enhanced status detection
  const getStatusInfo = (drop: Drop) => {
    const now = new Date()
    const accessModel = getAccessModel(drop)
    
    if (!drop.is_active) {
      return { 
        label: 'Inactive', 
        color: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700',
        accessModel 
      }
    }

    // Handle creation-based expiry
    if (drop.expires_at) {
      const expiresAt = new Date(drop.expires_at)
      if (expiresAt < now) {
        return { 
          label: 'Expired', 
          color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
          accessModel 
        }
      }
    }

    // Handle one-time access
    if (drop.one_time_access && drop.access_count && drop.access_count > 0) {
      return { 
        label: 'Used', 
        color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
        accessModel 
      }
    }

    return { 
      label: 'Active', 
      color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
      accessModel 
    }
  }

  // Enhanced active drops calculation
  const calculateActiveDrops = (dropsList: Drop[]) => {
    const now = new Date()
    return dropsList.filter(drop => {
      if (!drop.is_active) return false
      
      // One-time access that's been used
      if (drop.one_time_access && drop.access_count && drop.access_count > 0) return false
      
      // Creation-based expiry
      if (drop.expires_at) {
        return new Date(drop.expires_at) > now
      }
      
      // Verification-based or no expiry
      return true
    }).length
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    } else if (user) {
      // Try to load from cache first
      const cachedData = loadFromCache()
      
      if (cachedData) {
        // Use cached data
        setDrops(cachedData.drops)
        setStats(cachedData.stats)
        applyFilters(cachedData.drops, searchQuery, filterStatus)
        setLastFetch(cachedData.timestamp)
        setIsLoading(false)
      } else {
        // Fetch fresh data
        fetchDrops()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  const fetchDrops = async (forceRefresh = false) => {
    // If we just fetched recently and it's not a forced refresh, skip
    if (!forceRefresh && isCacheValid(lastFetch)) {
      return
    }

    if (forceRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const { data: dropsData, error: dropsError } = await supabase
        .from('drops')
        .select(`
          *,
          drop_recipients(count),
          drop_access_logs(count)
        `)
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false })
      
      if (dropsError) throw dropsError

      const processedDrops = (dropsData || []).map((drop: any) => ({
        ...drop,
        recipient_count: Array.isArray(drop.drop_recipients) && drop.drop_recipients.length > 0
          ? drop.drop_recipients[0].count
          : 0,
        access_count: Array.isArray(drop.drop_access_logs) && drop.drop_access_logs.length > 0
          ? drop.drop_access_logs[0].count
          : 0,
      }))

      const active = calculateActiveDrops(processedDrops)
      const totalAccesses = processedDrops.reduce((sum, d) => sum + (d.access_count || 0), 0)
      const totalRecipients = processedDrops.reduce((sum, d) => sum + (d.recipient_count || 0), 0)

      const newStats = {
        totalDrops: processedDrops.length,
        activeDrops: active,
        totalAccesses,
        totalRecipients
      }

      setDrops(processedDrops)
      setStats(newStats)
      applyFilters(processedDrops, searchQuery, filterStatus)
      setLastFetch(Date.now())

      // Save to cache
      saveToCache(processedDrops, newStats)

      if (forceRefresh) {
        toast.success('Dashboard refreshed')
      }
    } catch (error) {
      console.error('Error fetching drops:', error)
      toast.error('Failed to load drops')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    clearCache()
    fetchDrops(true)
  }

  const applyFilters = (dropsList: Drop[], search: string, status: string) => {
    let filtered = dropsList

    if (search.trim() !== '') {
      filtered = filtered.filter(drop =>
        drop.name.toLowerCase().includes(search.toLowerCase()) ||
        drop.description?.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (status !== 'all') {
      const now = new Date()
      filtered = filtered.filter(drop => {
        switch (status) {
          case 'active':
            if (!drop.is_active) return false
            if (drop.one_time_access && drop.access_count && drop.access_count > 0) return false
            if (drop.expires_at) return new Date(drop.expires_at) > now
            return true
          case 'expired':
            if (drop.expires_at) return new Date(drop.expires_at) <= now
            if (drop.one_time_access && drop.access_count && drop.access_count > 0) return true
            return false
          case 'inactive':
            return !drop.is_active
          default:
            return true
        }
      })
    }

    setFilteredDrops(filtered)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilters(drops, query, filterStatus)
  }

  const handleFilterChange = (status: string) => {
    setFilterStatus(status as any)
    applyFilters(drops, searchQuery, status)
  }

  const copyDropLink = async (dropId: string) => {
    try {
      const link = `${window.location.origin}/drops/${dropId}`
      await navigator.clipboard.writeText(link)
      toast.success('Link copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  const deleteDrop = async (dropId: string) => {
    if (!confirm('Delete this drop permanently?')) return
    
    try {
      const { error } = await supabase
        .from('drops')
        .delete()
        .eq('id', dropId)
        .eq('owner_id', user?.id)

      if (error) throw error

      toast.success('Drop deleted')
      // Clear cache and refresh data
      clearCache()
      fetchDrops(true)
    } catch (error) {
      console.error('Error deleting drop:', error)
      toast.error('Failed to delete drop')
    }
  }

  const downloadFile = (filePath: string) => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/${filePath}`
    window.open(url, '_blank')
  }

  const getTimeRemaining = (drop: Drop) => {
    const accessModel = getAccessModel(drop)
    
    if (accessModel.type === 'creation' && drop.expires_at) {
      const now = new Date()
      const expiry = new Date(drop.expires_at)
      const diff = expiry.getTime() - now.getTime()
      if (diff <= 0) return 'Expired'

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) return `${days}d ${hours}h`
      if (hours > 0) return `${hours}h ${minutes}m`
      if (minutes > 0) return `${minutes}m`
      return '<1m'
    } else if (accessModel.type === 'verification' && drop.default_time_limit_hours) {
      const hours = drop.default_time_limit_hours
      if (hours < 24) return `${hours}h each`
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return remainingHours === 0 ? `${days}d each` : `${days}d ${remainingHours}h each`
    }
    
    return 'No limit'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Show skeleton while loading initial data
  if (loading || isLoading || subscriptionLoading) {
    return <DashboardSkeleton viewMode={viewMode} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
     <Navbar/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20 mt-5 dark:bg-gray-900">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                Dashboard
                {currentPlan !== 'free' && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                    <Crown className="w-3 h-3 mr-1" />
                    {currentPlan === 'weekly' ? 'Weekly' : currentPlan === 'monthly' ? 'Monthly' : 'Business'}
                  </Badge>
                )}
              </h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Manage your secure drops and access models
                {remainingDrops && (
                  <>
                    <span> • </span>
                    <span className={remainingDrops.count <= 2 ? 'text-orange-600 dark:text-orange-400' : ''}>
                      {remainingDrops.count} drops remaining this {remainingDrops.period}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!canCreateDrop() && (
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/pricing')}
                  className="px-5 py-2.5 rounded-lg font-medium border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade Plan
                </Button>
              )}
              <Link href="/drops/new">
                <Button 
                  className="px-5 py-2.5 rounded-lg font-medium"
                  disabled={!canCreateDrop()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Drop
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats - 2x2 Grid on Mobile with Subscription Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">
                Drops {remainingDrops ? 'Used' : 'Total'}
              </span>
                            <FileUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">
              {remainingDrops ? (
                currentPlan === 'weekly' 
                  ? `${usage.dropsThisWeek}/${remainingDrops.total}` 
                  : `${usage.dropsThisMonth}/${remainingDrops.total}`
              ) : stats.totalDrops}
            </div>
            {remainingDrops && (
              <div className="mt-1">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, currentPlan === 'weekly' 
                        ? (usage.dropsThisWeek / remainingDrops.total) * 100
                        : (usage.dropsThisMonth / remainingDrops.total) * 100
                      )}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {remainingDrops.count} remaining this {remainingDrops.period}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Storage Used</span>
              <Activity className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">
              {planLimits ? (
                `${Math.round(usage.storageUsedMB)}MB / ${Math.round(planLimits.max_storage_gb * 1024)}MB`
              ) : (
                `${Math.round(usage.storageUsedMB)}MB`
              )}
            </div>
            {planLimits && (
              <div className="mt-1">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-600 dark:bg-green-400 transition-all duration-300"
                    style={{ width: `${getStoragePercentage()}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getStoragePercentage().toFixed(1)}% used
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Recipients</span>
              <Users className="w-3 h-3 md:w-4 md:h-4 text-primary" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.totalRecipients}
            </div>
            {planLimits && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max {planLimits.max_recipients_per_drop} per drop
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Plan</span>
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white capitalize">
              {currentPlan}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {getPlanPrice()}
            </div>
          </div>
        </div>

        {/* Plan Limit Warning */}
        {isNearLimit() && (
          <div className="mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Approaching Plan Limit
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  {currentPlan === 'weekly' 
                    ? `You've used ${usage.dropsThisWeek} of ${planLimits?.drops_per_week} drops this week.`
                    : `You've used ${usage.dropsThisMonth} of ${planLimits?.drops_per_month} drops this month.`
                  } Consider upgrading for more capacity.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => router.push('/pricing')}
                className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-950/30"
              >
                Upgrade
              </Button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search drops..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <Select value={filterStatus} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[140px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="all" className="text-gray-900 dark:text-white focus:bg-gray-100 dark:focus:bg-gray-700">All Drops</SelectItem>
                  <SelectItem value="active" className="text-gray-900 dark:text-white focus:bg-gray-100 dark:focus:bg-gray-700">Active</SelectItem>
                  <SelectItem value="expired" className="text-gray-900 dark:text-white focus:bg-gray-100 dark:focus:bg-gray-700">Expired</SelectItem>
                  <SelectItem value="inactive" className="text-gray-900 dark:text-white focus:bg-gray-100 dark:focus:bg-gray-700">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="font-medium"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-3"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Drops Display */}
        {filteredDrops.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <Shield className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery || filterStatus !== 'all' ? 'No drops found' : 'No drops yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter'
                : 'Create your first secure drop to get started'
              }
            </p>
            {!searchQuery && filterStatus === 'all' && canCreateDrop() && (
              <Link href="/drops/new">
                <Button className="font-medium">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Drop
                </Button>
              </Link>
            )}
            {!canCreateDrop() && (
              <Button 
                variant="outline"
                onClick={() => router.push('/pricing')}
                className="font-medium border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Create More Drops
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDrops.map((drop) => {
              const status = getStatusInfo(drop)
              const accessModel = status.accessModel
              const AccessIcon = accessModel.icon
              
              return (
                <div key={drop.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        drop.drop_type === 'file' 
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                          : 'bg-primary/10 text-primary dark:bg-primary/20'
                      }`}>
                        {drop.drop_type === 'file' ? (
                          <FileUp className="w-5 h-5" />
                        ) : (
                          <Link2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {drop.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {drop.drop_type}
                        </p>
                      </div>
                    </div>
                    <CustomDropdown
                      trigger={
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      }
                    >
                      <DropdownItem onClick={() => router.push(`/drops/${drop.id}/manage`)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Manage
                      </DropdownItem>
                      <DropdownItem onClick={() => copyDropLink(drop.id)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Link
                      </DropdownItem>
                      {drop.drop_type === 'file' && drop.file_path && (
                        <DropdownItem onClick={() => downloadFile(drop.file_path!)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownItem>
                      )}
                      <DropdownSeparator />
                      <DropdownItem onClick={() => deleteDrop(drop.id)} className="text-red-600 dark:text-red-400">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownItem>
                    </CustomDropdown>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </div>
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      <AccessIcon className="w-3 h-3 mr-1" />
                      {accessModel.label}
                    </div>
                  </div>

                  {drop.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {drop.description}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Users className="w-4 h-4 mr-1.5" />
                        Recipients
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">{drop.recipient_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Eye className="w-4 h-4 mr-1.5" />
                        Views
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">{drop.access_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <AccessIcon className="w-4 h-4 mr-1.5" />
                        {accessModel.type === 'creation' ? 'Expires' : accessModel.type === 'verification' ? 'Duration' : 'Access'}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">{getTimeRemaining(drop)}</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full font-medium border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => router.push(`/drops/${drop.id}/manage`)}
                  >
                    Manage Drop
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Drops</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all your secure drops and access models</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Drop
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status & Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Recipients
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Access
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDrops.map((drop) => {
                    const status = getStatusInfo(drop)
                    const accessModel = status.accessModel
                    const AccessIcon = accessModel.icon
                    
                    return (
                      <tr key={drop.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-lg mr-3 ${
                              drop.drop_type === 'file' 
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                : 'bg-primary/10 text-primary dark:bg-primary/20'
                            }`}>
                              {drop.drop_type === 'file' ? (
                                <FileUp className="w-4 h-4" />
                              ) : (
                                <Link2 className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {drop.name}
                              </div>
                              {drop.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                  {drop.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </div>
                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              <AccessIcon className="w-3 h-3 mr-1" />
                              {accessModel.label}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {drop.recipient_count || 0}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {drop.access_count || 0}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {getTimeRemaining(drop)}
                        </td>
                        <td className="px-6 py-4">
                          <CustomDropdown
                            trigger={
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            }
                          >
                            <DropdownItem onClick={() => router.push(`/drops/${drop.id}/manage`)}>
                              <Settings className="w-4 h-4 mr-2" />
                              Manage
                            </DropdownItem>
                            <DropdownItem onClick={() => copyDropLink(drop.id)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Link
                            </DropdownItem>
                            {drop.drop_type === 'file' && drop.file_path && (
                              <DropdownItem onClick={() => downloadFile(drop.file_path!)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownItem>
                            )}
                            <DropdownSeparator />
                            <DropdownItem onClick={() => deleteDrop(drop.id)} className="text-red-600 dark:text-red-400">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownItem>
                          </CustomDropdown>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}