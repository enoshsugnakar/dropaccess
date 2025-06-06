'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
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
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Drop {
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
  recipient_count?: number
  access_count?: number
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [drops, setDrops] = useState<Drop[]>([])
  const [filteredDrops, setFilteredDrops] = useState<Drop[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDrops: 0,
    activeDrops: 0,
    totalAccesses: 0,
    totalRecipients: 0
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    } else if (user) {
      fetchDrops()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  const fetchDrops = async () => {
    setIsLoading(true)
    try {
      // Fetch drops
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

      // Process the data
      const processedDrops = (dropsData || []).map((drop: any) => ({
        ...drop,
        recipient_count: Array.isArray(drop.drop_recipients) && drop.drop_recipients.length > 0
          ? drop.drop_recipients[0].count
          : 0,
        access_count: Array.isArray(drop.drop_access_logs) && drop.drop_access_logs.length > 0
          ? drop.drop_access_logs[0].count
          : 0,
      }))

      setDrops(processedDrops)
      setFilteredDrops(processedDrops)

      // Calculate stats
      const active = processedDrops.filter(d =>
        d.is_active && new Date(d.expires_at) > new Date()
      ).length

      const totalAccesses = processedDrops.reduce((sum, d) => sum + (d.access_count || 0), 0)
      const totalRecipients = processedDrops.reduce((sum, d) => sum + (d.recipient_count || 0), 0)

      setStats({
        totalDrops: processedDrops.length,
        activeDrops: active,
        totalAccesses,
        totalRecipients
      })
    } catch (error) {
      console.error('Error fetching drops:', error)
      toast.error('Failed to load drops')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setFilteredDrops(drops)
    } else {
      const filtered = drops.filter(drop =>
        drop.name.toLowerCase().includes(query.toLowerCase()) ||
        drop.description?.toLowerCase().includes(query.toLowerCase())
      )
      setFilteredDrops(filtered)
    }
  }

  const copyDropLink = (dropId: string) => {
    const link = `${window.location.origin}/drops/${dropId}`
    navigator.clipboard.writeText(link)
    toast.success('Drop link copied to clipboard')
  }

  const deleteDrop = async (dropId: string) => {
    if (!confirm('Are you sure you want to delete this drop?')) return
    try {
      const { error } = await supabase
        .from('drops')
        .delete()
        .eq('id', dropId)

      if (error) throw error

      toast.success('Drop deleted successfully')
      fetchDrops()
    } catch (error) {
      console.error('Error deleting drop:', error)
      toast.error('Failed to delete drop')
    }
  }

  const getStatusBadge = (drop: Drop) => {
    const now = new Date()
    const expiresAt = new Date(drop.expires_at)
    if (!drop.is_active) {
      return <Badge variant="secondary">Inactive</Badge>
    }
    if (expiresAt < now) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (drop.one_time_access && drop.access_count && drop.access_count > 0) {
      return <Badge variant="destructive">Used</Badge>
    }
    return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    if (diff <= 0) return 'Expired'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h`
    return 'Less than 1h'
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (

    <div className="min-h-screen bg-gray-50 pt-10">
       <Navbar/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-gray-600">Manage your secure drops</p>
          </div>
          
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Drops</CardDescription>
              <CardTitle className="text-2xl">{stats.totalDrops}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Drops</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.activeDrops}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Recipients</CardDescription>
              <CardTitle className="text-2xl">{stats.totalRecipients}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Accesses</CardDescription>
              <CardTitle className="text-2xl">{stats.totalAccesses}</CardTitle>
            </CardHeader>
          </Card>
        </div>
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search drops..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-96"
            />
          </div>
        </div>
        {/* Drops Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Drops</CardTitle>
            <CardDescription>All your secure drops in one place</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredDrops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'No drops found matching your search' : 'No drops created yet'}
                </p>
                {!searchQuery && (
                  <Link href="/drops/new">
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Drop
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Drop
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recipients
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Accesses
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDrops.map((drop) => (
                      <tr key={drop.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div href={`/drops/${drop.id}/manage`}>
                            <div className="text-sm font-medium text-gray-900">
                              {drop.name}
                            </div>
                            {drop.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {drop.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            {drop.drop_type === 'file' ? (
                              <>
                                <FileUp className="w-4 h-4 mr-1 text-blue-500" />
                                File
                              </>
                            ) : (
                              <>
                                <Link2 className="w-4 h-4 mr-1 text-purple-500" />
                                URL
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(drop)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Users className="w-4 h-4 mr-1 text-gray-400" />
                            {drop.recipient_count || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Eye className="w-4 h-4 mr-1 text-gray-400" />
                            {drop.access_count || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Clock className="w-4 h-4 mr-1 text-gray-400" />
                            {getTimeRemaining(drop.expires_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/drops/${drop.id}/manage`} className="flex items-center">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Drop
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyDropLink(drop.id)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy Link
                              </DropdownMenuItem>
                              {drop.drop_type === 'file' && drop.file_path && (
                                <DropdownMenuItem asChild>
                                  <a 
                                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/${drop.file_path}`}
                                    download
                                    className="flex items-center"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download File
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => deleteDrop(drop.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
