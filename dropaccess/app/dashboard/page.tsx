'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/hooks/use-subscription'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-20 animate-pulse"></div>
      </div>
    </div>
  )
}

function DashboardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Action Bar Skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="w-full md:w-96">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
          </div>
        </div>

        {/* Drops Grid/List Skeleton */}
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'
          : 'space-y-4'
        }>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <DropCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Custom Dropdown Component
interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function Dropdown({ trigger, children }: DropdownProps) {
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
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
          {children}
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
    isLoading: subscriptionLoading,
    canCreateDrop,
    getRemainingDrops,
    getStorageUsedPercent,
    refreshUsage
  } = useSubscription()

  const remainingDrops = getRemainingDrops()

  // Check if data is cached and still valid
  const isCacheValid = () => {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return false
    
    const data: CacheData = JSON.parse(cached)
    return (Date.now() - data.timestamp) < CACHE_DURATION
  }

  // Get cached data
  const getCachedData = (): CacheData | null => {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    return JSON.parse(cached)
  }

  // Save data to cache
  const saveToCache = (drops: Drop[], stats: any) => {
    const cacheData: CacheData = {
      drops,
      stats,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
  }

  // Clear cache
  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY)
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      // Try to load from cache first
      if (isCacheValid()) {
        const cached = getCachedData()
        if (cached) {
          setDrops(cached.drops)
          setFilteredDrops(cached.drops)
          setStats(cached.stats)
          setIsLoading(false)
          setLastFetch(cached.timestamp)
          return
        }
      }
      
      // Otherwise fetch fresh data
      fetchDrops()
    }
  }, [user])

  useEffect(() => {
    // Filter drops based on search and status
    let filtered = drops

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(drop =>
        drop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drop.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(drop => {
        if (filterStatus === 'active') {
          return drop.is_active && (!drop.expires_at || new Date(drop.expires_at) > new Date())
        } else if (filterStatus === 'expired') {
          return drop.expires_at && new Date(drop.expires_at) <= new Date()
        } else if (filterStatus === 'inactive') {
          return !drop.is_active
        }
        return true
      })
    }

    setFilteredDrops(filtered)
  }, [searchQuery, filterStatus, drops])

  const fetchDrops = async (forceRefresh = false) => {
    if (!user) return

    // If not forcing refresh and data was fetched recently, skip
    if (!forceRefresh && lastFetch && (Date.now() - lastFetch) < 60000) {
      return
    }

    setIsRefreshing(true)
    
    try {
      // Fetch drops with recipient counts
      const { data: dropsData, error: dropsError } = await supabase
        .from('drops')
        .select(`
          *,
          drop_recipients (count),
          drop_access_logs (count)
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (dropsError) throw dropsError

      // Format drops data
      const formattedDrops = dropsData?.map(drop => ({
        ...drop,
        recipient_count: drop.drop_recipients?.[0]?.count || 0,
        access_count: drop.drop_access_logs?.[0]?.count || 0
      })) || []

      // Calculate stats
      const totalDrops = formattedDrops.length
      const activeDrops = formattedDrops.filter(d => 
        d.is_active && (!d.expires_at || new Date(d.expires_at) > new Date())
      ).length
      const totalRecipients = formattedDrops.reduce((sum, d) => sum + (d.recipient_count || 0), 0)
      const totalAccesses = formattedDrops.reduce((sum, d) => sum + (d.access_count || 0), 0)

      const statsData = {
        totalDrops,
        activeDrops,
        totalRecipients,
        totalAccesses
      }

      setDrops(formattedDrops)
      setFilteredDrops(formattedDrops)
      setStats(statsData)
      setLastFetch(Date.now())

      // Save to cache
      saveToCache(formattedDrops, statsData)

      // Refresh usage data
      await refreshUsage()

    } catch (error) {
      console.error('Error fetching drops:', error)
      toast.error('Failed to load drops')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const copyDropLink = (dropId: string) => {
    const dropLink = `${window.location.origin}/drops/${dropId}`
    navigator.clipboard.writeText(dropLink)
    toast.success('Drop link copied!')
  }

  const toggleDropStatus = async (dropId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('drops')
        .update({ is_active: !currentStatus })
        .eq('id', dropId)
        .eq('owner_id', user?.id)

      if (error) throw error

      toast.success(`Drop ${!currentStatus ? 'activated' : 'deactivated'}`)
      // Update local state immediately
      setDrops(prevDrops =>
        prevDrops.map(drop =>
          drop.id === dropId ? { ...drop, is_active: !currentStatus } : drop
        )
      )
      clearCache() // Clear cache to force fresh data on next load
    } catch (error) {
      console.error('Error toggling drop status:', error)
      toast.error('Failed to update drop status')
    }
  }

  const deleteDrop = async (dropId: string) => {
    if (!confirm('Are you sure you want to delete this drop? This action cannot be undone.')) return
    
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
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/drops/${filePath}`
    window.open(url, '_blank')
  }

  const getAccessModel = (drop: Drop) => {
    if (drop.expires_at) {
      return { type: 'creation', label: 'Fixed Deadline' }
    } else if (drop.default_time_limit_hours) {
      return { type: 'verification', label: 'Start After Verification' }
    }
    return { type: 'none', label: 'No Time Limit' }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                Dashboard
                {planLimits && planLimits.plan_name !== 'free' && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                    <Crown className="w-3 h-3 mr-1" />
                    {planLimits.plan_name}
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage your secure drops and track their performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDrops(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                onClick={() => router.push('/drops/new')}
                disabled={!canCreateDrop()}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Drop
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Total Drops</span>
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">
              {remainingDrops ? (
                planLimits?.plan_name === 'weekly' 
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
                      width: `${Math.min(100, planLimits?.plan_name === 'weekly' 
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
                    style={{ width: `${getStorageUsedPercent()}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getStorageUsedPercent().toFixed(1)}% used
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Active Drops</span>
              <Shield className="w-3 h-3 md:w-4 md:h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">{stats.activeDrops}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Currently accessible</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Total Accesses</span>
              <Eye className="w-3 h-3 md:w-4 md:h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalAccesses}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">All time views</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="w-full md:w-96">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search drops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drops</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Drops Grid/List */}
        {filteredDrops.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
            <div className="max-w-md mx-auto">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery || filterStatus !== 'all' ? 'No drops found' : 'No drops yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first drop to start sharing files and URLs securely'
                }
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Button onClick={() => router.push('/drops/new')} disabled={!canCreateDrop()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Drop
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'
            : 'space-y-4'
          }>
            {filteredDrops.map((drop) => {
              const accessModel = getAccessModel(drop)
              const isExpired = drop.expires_at && new Date(drop.expires_at) <= new Date()
              
              return (
                <Card 
                  key={drop.id} 
                  className={`transition-all duration-200 hover:shadow-lg ${
                    !drop.is_active || isExpired 
                      ? 'opacity-60' 
                      : ''
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          drop.drop_type === 'file' 
                            ? 'bg-blue-100 dark:bg-blue-900' 
                            : 'bg-purple-100 dark:bg-purple-900'
                        }`}>
                          {drop.drop_type === 'file' 
                            ? <FileUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            : <Link2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {drop.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(drop.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                        <DropdownItem 
                          onClick={() => toggleDropStatus(drop.id, drop.is_active)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          {drop.is_active ? 'Deactivate' : 'Activate'}
                        </DropdownItem>
                        <DropdownItem 
                          onClick={() => deleteDrop(drop.id)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownItem>
                      </Dropdown>
                    </div>

                    {/* Access Model Badge */}
                    <div className="mb-4">
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {accessModel.type === 'verification' && <Timer className="w-3 h-3 mr-1" />}
                        {accessModel.type === 'creation' && <CalendarDays className="w-3 h-3 mr-1" />}
                        {accessModel.label}
                      </Badge>
                    </div>

                    {/* Description */}
                    {drop.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {drop.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400 flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          Recipients
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {drop.recipient_count || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400 flex items-center">
                          <Eye className="w-3 h-3 mr-1" />
                          Accesses
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {drop.access_count || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Time Left
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {getTimeRemaining(drop)}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/drops/${drop.id}/manage`)}
                      >
                        Manage
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                      
                      <Badge 
                        variant={isExpired ? 'destructive' : drop.is_active ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {isExpired ? 'Expired' : drop.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Upgrade Prompt for Free Users */}
        {planLimits?.plan_name === 'free' && drops.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Unlock More Features
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Upgrade to a paid plan for more drops, larger files, and advanced features
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Up to 200 drops/month
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <FileUp className="w-3 h-3 mr-1" />
                    Up to 500MB files
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    Up to 100 recipients
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Timer className="w-3 h-3 mr-1" />
                    Start after verification
                  </Badge>
                </div>
                <Button onClick={() => router.push('/pricing')} className="bg-gradient-to-r from-primary to-primary/80">
                  View Plans
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <Crown className="w-8 h-8 text-primary opacity-20" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}