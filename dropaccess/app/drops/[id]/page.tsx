'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Clock, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function DropAccessPage() {
  const params = useParams()
  const dropId = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dropData, setDropData] = useState<any>(null)

  useEffect(() => {
    if (dropId) {
      checkDropAccess()
    }
  }, [dropId])

  const checkDropAccess = async () => {
    try {
      // In a real implementation, this would check recipient access
      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('id', dropId)
        .single()

      if (error) throw error

      if (!data) {
        setError('Drop not found')
        return
      }

      // Check if drop has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This drop has expired')
        return
      }

      setDropData(data)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>{dropData?.name}</CardTitle>
          <CardDescription>
            {dropData?.drop_type === 'url' ? 'Secure Link' : 'Secure File'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dropData?.expires_at && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This drop expires on {new Date(dropData.expires_at).toLocaleString()}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Click below to access the content
            </p>
            <Button className="w-full">
              {dropData?.drop_type === 'url' ? 'Access Link' : 'Download File'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}