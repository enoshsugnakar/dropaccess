'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/Navbar'
import { Input } from '@/components/ui/input'
import { ClientAuthWrapper } from '@/components/ClientAuthWrapper'
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
  ChevronLeft
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
import { SubscriptionStatus } from '@/components/SubscriptionStatus'
import { useSubscription } from '@/components/SubscriptionProvider'

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
  updated_at: string
  recipient_count?: number
  access_count?: number
}

interface Stats {
  totalDrops: number
  activeDrops: number
  totalRecipients: number
  totalViews: number
  // Subscription limits
  activeDropsLimit: number
  monthlyRecipientsLimit: number
}

interface UsageData {
  monthly: {
    drops_created: number
    recipients_added: number
    storage_used_mb: number
  }
  limits: {
    drops: number
    recipients: number
    storage: number
    file_size_mb: number
  }
  subscription: {
    tier: string
    status: string
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const { usageData, refreshUsage } = useSubscription()
  
  // State
  const [drops, setDrops] = useState<Drop[]>([])
  const [allDrops, setAllDrops] = useState<Drop[]>([]) // Cache all drops
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalDrops: 0,
    activeDrops: 0, 
    totalRecipients: 0,
    totalViews: 0,
    activeDropsLimit: 3,
    monthlyRecipientsLimit: 9
  })
  //const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [refreshing, setRefreshing] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = viewMode === 'grid' ? 9 : 15

  // Cache management
  const lastFetchTime = useRef<number>(0)
  const CACHE_DURATION = 30000 // 30 seconds

  // Calculate subscription limits based on tier
  const calculateSubscriptionLimits = useCallback((tier: string) => {
    switch (tier) {
      case 'individual':
        return {
          activeDropsLimit: 15,
          monthlyRecipientsLimit: 15 * 20 // 15 drops × 20 recipients
        }
      case 'business':
        return {
          activeDropsLimit: -1, // Unlimited
          monthlyRecipientsLimit: -1 // Unlimited
        }
      default: // free
        return {
          activeDropsLimit: 3,
          monthlyRecipientsLimit: 3 * 3 // 3 drops × 3 recipients
        }
    }
  }, [])

  const fetchRecipientCount = useCallback(async () => {
    if (!user?.id) return
  
    try {
      const response = await fetch(`/api/recipients/count?userId=${user.id}`)
      
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({
          ...prev,
          totalRecipients: data.recipientCount || 0
        }))
      }
    } catch (error) {
      console.error('Error fetching recipient count:', error)
    }
  }, [user?.id])

  const fetchTotalViews = useCallback(async () => {
    if (!user?.id) return
  
    try {
      const response = await fetch(`/api/views/count?userId=${user.id}`)
      
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({
          ...prev,
          totalViews: data.totalViews || 0
        }))
      }
    } catch (error) {
      console.error('Error fetching total views:', error)
    }
  }, [user?.id])

  // Fetch drops with smart caching
  const fetchDrops = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return
  
    const now = Date.now()
    if (!forceRefresh && now - lastFetchTime.current < CACHE_DURATION && allDrops.length > 0) {
      return // Use cached data
    }
  
    try {
      setLoading(forceRefresh ? false : true)
      
      // Simple query - no recipient counting here
      const { data: dropsData, error } = await supabase
        .from('drops')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
  
      if (error) throw error
  
      setAllDrops(dropsData || [])
      lastFetchTime.current = now
  
      // Calculate basic stats
      const totalDropsCount = dropsData?.length || 0
      const activeDropsCount = dropsData?.filter(drop => drop.is_active).length || 0
      
      setStats(prev => ({
        ...prev,
        totalDrops: totalDropsCount,
        activeDrops: activeDropsCount
      }))
  
      // Fetch both recipient count and total views
      fetchRecipientCount()
      fetchTotalViews()  // Add this line
  
    } catch (error) {
      console.error('Error fetching drops:', error)
      toast.error('Failed to load drops')
    } finally {
      setLoading(false)
    }
  }, [user?.id, fetchRecipientCount, fetchTotalViews])
  

// Update your useEffect to call both:
useEffect(() => {
  if (user?.id) {
    refreshUsage()
    fetchDrops()
  }
}, [user?.id, refreshUsage, fetchDrops])

  // Filter and sort drops with memoization
  const filteredAndSortedDrops = useMemo(() => {
    let filtered = [...allDrops]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(drop =>
        drop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        drop.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(drop => {
        switch (filterStatus) {
          case 'active':
            return drop.is_active && (!drop.expires_at || new Date(drop.expires_at) > new Date())
          case 'inactive':
            return !drop.is_active
          case 'expired':
            return drop.expires_at && new Date(drop.expires_at) <= new Date()
          default:
            return true
        }
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return filtered
  }, [allDrops, searchTerm, filterStatus, sortBy])

  // Paginated drops
  const paginatedDrops = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedDrops.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedDrops, currentPage, itemsPerPage])

  // Pagination info
  const totalPages = Math.ceil(filteredAndSortedDrops.length / itemsPerPage)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Reset page when view mode changes
  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, searchTerm, filterStatus, sortBy])

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      
      fetchDrops()
    }
  }, [user?.id, fetchDrops])

  useEffect(() => {
    if (usageData) {
      const limits = calculateSubscriptionLimits(usageData.subscription.tier)
      setStats(prev => ({
        ...prev,
        activeDropsLimit: limits.activeDropsLimit,
        monthlyRecipientsLimit: limits.monthlyRecipientsLimit,
        totalRecipients: usageData.monthly.recipients_added
      }))
    }
  }, [usageData, calculateSubscriptionLimits])

  const getRecipientLimit = () => {
    if (!usageData) return 0
    
    // If unlimited drops or recipients
    if (usageData.limits.drops === -1 || usageData.limits.recipients === -1) {
      return -1
    }
    
    // Calculate total possible recipients: drops_limit × recipients_per_drop_limit
    return usageData.limits.drops * usageData.limits.recipients
  }
  

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      refreshUsage(),
      fetchDrops(true)
    ])
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  if (!user) {
    return <div>Please sign in to view your dashboard.</div>
  }

  return (
    <ClientAuthWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
            <div>
              <h1 className="text-2xl font-medium text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Manage your secure drops and track usage
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center gap-3">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button asChild>
                <Link href="/drops/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Drop
                </Link>
              </Button>
            </div>
          </div>

          {/* Enhanced Stats Cards with Subscription Limits */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
  {/* Total Drops - No limit shown */}
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-2 md:mb-3">
      <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Total Drops</span>
      <FileUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
    </div>
    <div className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">
      {stats.totalDrops}
    </div>
  </div>

  {/* Active Drops - With limit */}
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-2 md:mb-3">
      <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Active Drops</span>
      <Activity className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
    </div>
    <div className="text-lg md:text-2xl font-semibold text-green-600 dark:text-green-400">
      {stats.activeDropsLimit === -1 
        ? stats.activeDrops 
        : `${stats.activeDrops}/${stats.activeDropsLimit}`
      }
    </div>
  </div>

  {/* Recipients - With calculated total allowed */}
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-2 md:mb-3">
      <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Recipients</span>
      <Users className="w-3 h-3 md:w-4 md:h-4 text-purple-600 dark:text-purple-400" />
    </div>
    <div className="text-lg md:text-2xl font-semibold text-purple-600 dark:text-purple-400">
      {stats.monthlyRecipientsLimit === -1 
        ? stats.totalRecipients
        : `${stats.totalRecipients}/${stats.monthlyRecipientsLimit}`
      }
    </div>
  </div>

  {/* Total Views - New 4th card */}
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-2 md:mb-3">
      <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">Total Views</span>
      <Eye className="w-3 h-3 md:w-4 md:h-4 text-orange-600 dark:text-orange-400" />
    </div>
    <div className="text-lg md:text-2xl font-semibold text-orange-600 dark:text-orange-400">
      {stats.totalViews}
    </div>
  </div>
</div>
          
          {/* Filters and Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search drops..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Mode Toggle */}
                <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg">
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

            {/* Results Info */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                Showing {paginatedDrops.length} of {filteredAndSortedDrops.length} drops
                {searchTerm && ` matching "${searchTerm}"`}
              </span>
              {totalPages > 1 && (
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </div>

          {/* Drops Display */}
          {loading ? (
            <DropsSkeleton viewMode={viewMode} />
          ) : paginatedDrops.length === 0 ? (
            <EmptyState searchTerm={searchTerm} filterStatus={filterStatus} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
              {paginatedDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Drop
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Recipients
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedDrops.map((drop) => (
                      <DropTableRow key={drop.id} drop={drop} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!hasPrevPage}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={!hasNextPage}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Go to page:</span>
                <Input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value)
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page)
                    }
                  }}
                  className="w-16 text-center"
                />
                <span className="text-sm text-gray-500">of {totalPages}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ClientAuthWrapper>
  )
}

// Skeleton Components
function DropsSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <DropCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DropCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      </div>
      <div className="flex justify-between">
        <div className="w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </td>
      ))}
    </tr>
  )
}

// Empty State Component
function EmptyState({ searchTerm, filterStatus }: { searchTerm: string; filterStatus: string }) {
  const hasFilters = searchTerm || filterStatus !== 'all'

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
        <FileUp className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {hasFilters ? 'No drops found' : 'No drops yet'}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {hasFilters 
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'Create your first secure drop to get started sharing files and links safely.'
        }
      </p>
      <div className="flex items-center justify-center gap-3">
        {hasFilters ? (
          <Button
            variant="outline"
            onClick={() => {
              // Reset filters
              window.location.reload()
            }}
          >
            Clear Filters
          </Button>
        ) : null}
        <Button asChild>
          <Link href="/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Drop
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Drop Card Component (for grid view)
function DropCard({ drop }: { drop: Drop }) {
  const getStatusInfo = () => {
    if (!drop.is_active) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-800' }
    }
    
    if (drop.expires_at) {
      const expiryDate = new Date(drop.expires_at)
      const now = new Date()
      
      if (expiryDate <= now) {
        return { label: 'Expired', color: 'bg-red-100 text-red-800' }
      }
      
      const timeDiff = expiryDate.getTime() - now.getTime()
      const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60))
      
      if (hoursLeft <= 24) {
        return { label: 'Expiring Soon', color: 'bg-yellow-100 text-yellow-800' }
      }
    }
    
    return { label: 'Active', color: 'bg-green-100 text-green-800' }
  }

  const status = getStatusInfo()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {drop.drop_type === 'file' ? (
            <FileUp className="w-5 h-5 text-blue-600" />
          ) : (
            <Link2 className="w-5 h-5 text-purple-600" />
          )}
        </div>
        <Badge className={`text-xs ${status.color}`}>
          {status.label}
        </Badge>
      </div>
      
      <div className="mb-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-1 truncate">
          {drop.name}
        </h3>
        {drop.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {drop.description}
          </p>
        )}
      </div>

      <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3" />
          <span>{drop.recipient_count || 0} recipients</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          <span>{new Date(drop.created_at).toLocaleDateString()}</span>
        </div>
        {drop.expires_at && (
          <div className="flex items-center gap-2">
            <Timer className="w-3 h-3" />
            <span>Expires {new Date(drop.expires_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href={`/drops/${drop.id}/manage`}>
            <Settings className="w-3 h-3 mr-1" />
            Manage
          </Link>
        </Button>
        <CustomDropdown
          trigger={
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          }
        >
          <DropdownItem onClick={() => copyDropLink(drop.id)}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </DropdownItem>
          <DropdownItem onClick={() => shareDropLink(drop.id, drop.name)}>
            <Download className="w-4 h-4 mr-2" />
            Share
          </DropdownItem>
          <DropdownItem onClick={() => deleteDrop(drop.id)} className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownItem>
        </CustomDropdown>
      </div>
    </div>
  )
}

// Drop Table Row Component (for list view)
function DropTableRow({ drop }: { drop: Drop }) {
  const getStatusInfo = () => {
    if (!drop.is_active) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' }
    }
    
    if (drop.expires_at) {
      const expiryDate = new Date(drop.expires_at)
      const now = new Date()
      
      if (expiryDate <= now) {
        return { label: 'Expired', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
      }
      
      const timeDiff = expiryDate.getTime() - now.getTime()
      const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60))
      
      if (hoursLeft <= 24) {
        return { label: 'Expiring Soon', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' }
      }
    }
    
    return { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' }
  }

  const status = getStatusInfo()

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {drop.drop_type === 'file' ? (
            <FileUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          )}
          <div>
            <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
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
        <Badge className={`text-xs ${status.color}`}>
          {status.label}
        </Badge>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {drop.recipient_count || 0}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {drop.access_count || 0}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {drop.expires_at 
          ? new Date(drop.expires_at).toLocaleDateString()
          : 'Never'
        }
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/drops/${drop.id}/manage`}>
              Manage
            </Link>
          </Button>
          <CustomDropdown
            trigger={
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            }
          >
            <DropdownItem onClick={() => copyDropLink(drop.id)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </DropdownItem>
            <DropdownItem onClick={() => shareDropLink(drop.id, drop.name)}>
              <Download className="w-4 h-4 mr-2" />
              Share
            </DropdownItem>
            <DropdownItem onClick={() => deleteDrop(drop.id)} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownItem>
          </CustomDropdown>
        </div>
      </td>
    </tr>
  )
}

// Helper Functions
const copyDropLink = async (dropId: string) => {
  try {
    const link = `${window.location.origin}/drops/${dropId}`
    await navigator.clipboard.writeText(link)
    toast.success('Drop link copied to clipboard')
  } catch (err) {
    toast.error('Failed to copy link')
  }
}

const shareDropLink = async (dropId: string, dropName: string) => {
  const link = `${window.location.origin}/drops/${dropId}`
  const shareData = {
    title: `Access: ${dropName}`,
    text: `You've been granted access to "${dropName}" via DropAccess`,
    url: link
  }

  try {
    if (navigator.share && navigator.canShare(shareData)) {
      await navigator.share(shareData)
      toast.success('Shared successfully')
    } else {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied to clipboard')
    }
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(link)
        toast.success('Link copied to clipboard')
      } catch (copyErr) {
        toast.error('Failed to share link')
      }
    }
  }
}

const deleteDrop = async (dropId: string) => {
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
    window.location.reload() // Simple refresh for now
  } catch (error) {
    console.error('Error deleting drop:', error)
    toast.error('Failed to delete drop')
  }
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
      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center transition-colors ${className}`}
    >
      {children}
    </button>
  )
}