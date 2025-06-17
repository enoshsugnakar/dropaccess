// components/DropForm.tsx - Enhanced with Subscription Limits
'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Upload, 
  Link as LinkIcon, 
  Clock, 
  Users, 
  File, 
  AlertTriangle,
  CheckCircle,
  Crown,
  Zap,
  Database,
  Shield,
  X,
  Calendar
} from 'lucide-react'
import { format, addHours } from 'date-fns'
import toast from 'react-hot-toast'

// Import our new hooks and components
import { useSubscriptionLimits, useFeatureLimits, useUsageWarnings } from '@/hooks/useSubscriptionLimits'
import { useUpgradePrompt } from '@/components/UpgradePrompt'
import { FeatureBadge, FeatureGate } from '@/components/FeatureBadges'
import { updateUsageAfterDrop } from '@/lib/usageTracking'

interface DropFormData {
  name: string
  description: string
  dropType: 'file' | 'url'
  maskedUrl: string
  recipients: string
  timerMode: 'creation' | 'verification'
  defaultTimeLimitHours: number | null
  verificationDeadline?: Date
  creationExpiry: string
  sendNotifications: boolean
}

const TIME_PRESETS = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: '1 week', value: 168 },
  { label: 'Custom', value: null }
]

export function DropForm() {
  const { user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Subscription hooks
  const { 
    limitChecks, 
    canProceed, 
    isChecking, 
    checkLimits, 
    handleLimitExceeded,
    userTier,
    usageData 
  } = useSubscriptionLimits({ 
    autoCheck: true, 
    showUpgradePrompts: true 
  })
  
  const { hasAnalytics, requireFeature } = useFeatureLimits()
  const { warnings, hasWarnings } = useUsageWarnings()
  const { UpgradePromptComponent } = useUpgradePrompt()

  const [formData, setFormData] = useState<DropFormData>({
    name: '',
    description: '',
    dropType: 'url',
    maskedUrl: '',
    recipients: '',
    timerMode: 'verification',
    defaultTimeLimitHours: 24,
    verificationDeadline: undefined,
    creationExpiry: '',
    sendNotifications: true
  })

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [customDateTime, setCustomDateTime] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Real-time limit checking when form changes
  useEffect(() => {
    const recipientCount = getRecipientCount()
    const fileSizeMb = uploadedFile ? uploadedFile.size / (1024 * 1024) : 0
    checkLimits(recipientCount, fileSizeMb)
  }, [uploadedFile, formData.recipients, checkLimits])

  const updateField = (field: keyof DropFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const getRecipientCount = () => {
    if (!formData.recipients.trim()) return 0
    return formData.recipients
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0).length
  }

  const handleFileSelection = (file: File) => {
    const fileSizeMb = file.size / (1024 * 1024)
    
    // Check file size against current tier limits
    if (usageData?.limits?.storage !== -1 && fileSizeMb > (usageData?.limits?.storage || 10)) {
      handleLimitExceeded('canUploadFile')
      return
    }

    setUploadedFile(file)
    if (errors.file) {
      setErrors(prev => ({ ...prev, file: '' }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleFileSelection(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const ensureUserExists = async () => {
    if (!user?.id || !user?.email) return false

    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (fetchError && fetchError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            created_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('Error creating user:', insertError)
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Error ensuring user exists:', error)
      return false
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Drop name is required'
    }

    if (formData.dropType === 'url' && !formData.maskedUrl.trim()) {
      newErrors.maskedUrl = 'URL is required'
    }

    if (formData.dropType === 'file' && !uploadedFile) {
      newErrors.file = 'Please select a file'
    }

    if (formData.timerMode === 'creation' && formData.defaultTimeLimitHours === null && !customDateTime) {
      newErrors.customDateTime = 'Please set a custom expiry date'
    }

    // Check subscription limits
    if (!canProceed) {
      const issues = Object.entries(limitChecks || {})
        .filter(([_, check]) => !check.allowed)
        .map(([key, _]) => key)
      
      if (issues.length > 0) {
        newErrors.subscription = `Subscription limit exceeded: ${issues.join(', ')}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileUpload = async (file: File, dropId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop() ?? 'bin'
    const timestamp = Date.now()
    const randomPortion = Math.random().toString(36).substring(2, 10)
    const fileName = `${timestamp}_${randomPortion}.${fileExt}`
    const filePath = `${user!.id}/${dropId}/${fileName}`
    
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('drops')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }
    
    return filePath
  }

  const getExpiryDate = () => {
    if (formData.timerMode === 'creation' && formData.defaultTimeLimitHours === null) {
      return customDateTime ? new Date(customDateTime) : null
    } else if (formData.timerMode === 'creation' && formData.defaultTimeLimitHours !== null) {
      const now = new Date()
      return addHours(now, formData.defaultTimeLimitHours)
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast.error('Please sign in to create a drop')
      router.push('/auth')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the errors below')
      return
    }

    // Final subscription check before submission
    if (!canProceed) {
      const issues = Object.entries(limitChecks || {})
        .filter(([_, check]) => !check.allowed)
      
      if (issues.length > 0) {
        const [firstIssue, check] = issues[0]
        handleLimitExceeded(firstIssue as any)
        return
      }
    }

    setIsSubmitting(true)
    let insertedDrop: any = null
    
    try {
      // Ensure user exists
      const userExists = await ensureUserExists()
      if (!userExists) {
        throw new Error('Failed to create or verify user account')
      }

      const expiryDate = getExpiryDate()

      // Create the drop
      const dropPayload: any = {
        owner_id: user.id,
        name: formData.name.trim(),
        drop_type: formData.dropType,
        masked_url: formData.dropType === 'url' ? formData.maskedUrl.trim() : null,
        description: formData.description.trim() || null,
        one_time_access: false,
        is_active: true,
      }

      if (formData.timerMode === 'creation') {
        dropPayload.expires_at = expiryDate?.toISOString()
        dropPayload.default_time_limit_hours = null
      } else {
        dropPayload.expires_at = null
        dropPayload.default_time_limit_hours = formData.defaultTimeLimitHours
      }

      if (formData.timerMode === 'verification' && formData.verificationDeadline) {
        dropPayload.global_expires_at = formData.verificationDeadline.toISOString()
      }

      const { data: dropData, error: dropError } = await supabase
        .from('drops')
        .insert(dropPayload)
        .select()
        .single()

      if (dropError) {
        throw dropError
      }

      insertedDrop = dropData

      // Handle file upload if needed
      if (formData.dropType === 'file' && uploadedFile) {
        try {
          const filePath = await handleFileUpload(uploadedFile, insertedDrop.id)
          
          const { error: updateError } = await supabase
            .from('drops')
            .update({ file_path: filePath })
            .eq('id', insertedDrop.id)
            .eq('owner_id', user.id)

          if (updateError) {
            throw updateError
          }
        } catch (fileError) {
          await supabase.from('drops').delete().eq('id', insertedDrop.id)
          throw new Error(`File upload failed: ${(fileError as Error).message}`)
        }
      }

      // Update usage tracking
      try {
        const fileSizeMb = formData.dropType === 'file' && uploadedFile 
          ? uploadedFile.size / (1024 * 1024) 
          : 0

        const recipientEmails = formData.recipients
          .split(/[,\n]/)
          .map((email) => email.trim())
          .filter((email) => email.length > 0)

        await updateUsageAfterDrop(user.id, recipientEmails.length, fileSizeMb)
      } catch (usageError) {
        console.error('Failed to track usage (non-critical):', usageError)
      }

      // Process recipients
      const recipientEmails = formData.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0)

      if (recipientEmails.length > 0) {
        const recipientsPayload = recipientEmails.map((email) => ({
          drop_id: insertedDrop.id,
          email,
          verified_at: null,
          personal_expires_at: null,
          time_limit_hours: null,
        }))

        const { error: recipientsError } = await supabase
          .from('drop_recipients')
          .insert(recipientsPayload)

        if (recipientsError) {
          throw recipientsError
        }

        // Send email notifications if enabled
        if (formData.sendNotifications) {
          try {
            const { data: userProfile } = await supabase
              .from('users')
              .select('display_name')
              .eq('id', user.id)
              .single()
            
            const creatorDisplayName = userProfile?.display_name || user.email?.split('@')[0] || 'Someone'
            
            await fetch('/api/send-drop-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dropId: insertedDrop.id,
                recipientEmails: recipientEmails,
                dropData: insertedDrop,
                creatorEmail: user.email || 'Unknown User',
                creatorDisplayName: creatorDisplayName
              }),
            })
          } catch (emailError) {
            console.error('Error sending email notifications:', emailError)
            toast.error('Drop created but failed to send email notifications')
          }
        }
      }

      toast.success('Drop created successfully!')

      // Reset form
      setFormData({
        name: '',
        description: '',
        dropType: 'url',
        maskedUrl: '',
        recipients: '',
        timerMode: 'verification',
        defaultTimeLimitHours: 24,
        verificationDeadline: undefined,
        creationExpiry: '',
        sendNotifications: true,
      })
      setUploadedFile(null)
      setCustomDateTime('')
      setErrors({})
      
      router.push(`/drops/${insertedDrop.id}/manage`)
    } catch (err: any) {
      console.error('Error creating drop:', err)
      toast.error(err.message || 'Failed to create drop')
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const getTimeLimitDisplay = () => {
    if (formData.timerMode === 'creation' && formData.defaultTimeLimitHours === null) {
      return customDateTime ? format(new Date(customDateTime), "MMM d, yyyy 'at' hh:mm aa") : 'Custom - Not set'
    }
    
    const hours = formData.defaultTimeLimitHours
    if (!hours) return 'Not set'
    
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    } else if (hours % 24 === 0) {
      const days = hours / 24
      return `${days} day${days !== 1 ? 's' : ''}`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    }
  }

  const recipientCount = getRecipientCount()
  const fileSizeMb = uploadedFile ? Math.round((uploadedFile.size / (1024 * 1024)) * 10) / 10 : 0

  return (
    <>
      {/* Subscription Status Header */}
      <Card className="mb-6 border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                userTier === 'business' ? 'bg-purple-50 dark:bg-purple-900/20' :
                userTier === 'individual' ? 'bg-blue-50 dark:bg-blue-900/20' :
                'bg-gray-50 dark:bg-gray-800'
              }`}>
                {userTier === 'business' ? (
                  <Crown className="w-5 h-5 text-purple-500" />
                ) : userTier === 'individual' ? (
                  <Zap className="w-5 h-5 text-blue-500" />
                ) : (
                  <Shield className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <h3 className="font-medium">
                  {userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {usageData && (
                    <>
                      <span>
                        Drops: {usageData.monthly.drops_created}/{usageData.limits.drops === -1 ? '∞' : usageData.limits.drops}
                      </span>
                      <span>
                        Storage: {Math.round(usageData.monthly.storage_used_mb)}MB/{usageData.limits.storage === -1 ? '∞' : usageData.limits.storage + 'MB'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {hasWarnings && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-600">
                  {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Warnings */}
      {hasWarnings && (
        <div className="mb-6 space-y-2">
          {warnings.map((warning, index) => (
            <Alert key={index} className={`border-${warning.severity === 'critical' ? 'red' : 'orange'}-200`}>
              <AlertTriangle className={`w-4 h-4 text-${warning.severity === 'critical' ? 'red' : 'orange'}-500`} />
              <AlertDescription className="flex items-center justify-between">
                <span>{warning.message}</span>
                {warning.action && (
                  <Button variant="link" size="sm" onClick={warning.action}>
                    View Plans
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Drop Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Enter a name for your drop"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Drop Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Add a description for your drop"
            rows={3}
          />
        </div>

        {/* Drop Type Selection */}
        <div className="space-y-3">
          <Label>Drop Type *</Label>
          <RadioGroup
            value={formData.dropType}
            onValueChange={(value: 'file' | 'url') => updateField('dropType', value)}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <Card className={`cursor-pointer border-2 transition-all ${
                formData.dropType === 'url' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="url" id="url" />
                    <Label htmlFor="url" className="flex items-center gap-2 cursor-pointer">
                      <LinkIcon className="w-4 h-4 text-blue-500" />
                      Mask URL
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Hide any link behind DropAccess
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <Card className={`cursor-pointer border-2 transition-all ${
                formData.dropType === 'file' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4 text-blue-500" />
                      Upload File
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Max {usageData?.limits?.storage === -1 ? '∞' : `${usageData?.limits?.storage}MB`}
                  </p>
                </CardContent>
              </Card>
            </div>
          </RadioGroup>
        </div>

        {/* URL Input or File Upload */}
        {formData.dropType === 'url' ? (
          <div className="space-y-2">
            <Label htmlFor="maskedUrl">URL to Mask *</Label>
            <Input
              id="maskedUrl"
              value={formData.maskedUrl}
              onChange={(e) => updateField('maskedUrl', e.target.value)}
              placeholder="https://example.com/your-content"
              className={errors.maskedUrl ? 'border-red-500' : ''}
            />
            {errors.maskedUrl && (
              <p className="text-sm text-red-600">{errors.maskedUrl}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>File Upload *</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : errors.file 
                    ? 'border-red-300' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!uploadedFile ? openFileDialog : undefined}
            >
              {uploadedFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">{fileSizeMb}MB</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button type="button" variant="outline" size="sm" onClick={openFileDialog}>
                      Change File
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-8 h-8 mx-auto text-gray-400" />
                  <div>
                    <p className="font-medium">Drop files here or click to browse</p>
                    <p className="text-sm text-gray-500">
                      Max {usageData?.limits?.storage === -1 ? 'unlimited' : `${usageData?.limits?.storage}MB`}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            {errors.file && (
              <p className="text-sm text-red-600">{errors.file}</p>
            )}
          </div>
        )}

        {/* Recipients */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="recipients">Recipients</Label>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{recipientCount} recipients</span>
              {usageData && (
                <Badge variant={
                  usageData.limits.recipients !== -1 && recipientCount > usageData.limits.recipients 
                    ? 'destructive' 
                    : 'secondary'
                }>
                  Max {usageData.limits.recipients === -1 ? '∞' : usageData.limits.recipients}
                </Badge>
              )}
            </div>
          </div>
          <Textarea
            id="recipients"
            value={formData.recipients}
            onChange={(e) => updateField('recipients', e.target.value)}
            placeholder="Enter email addresses (one per line or comma-separated)"
            rows={3}
            className={
              limitChecks?.canAddRecipients && !limitChecks.canAddRecipients.allowed 
                ? 'border-red-500' 
                : ''
            }
          />
          {limitChecks?.canAddRecipients && !limitChecks.canAddRecipients.allowed && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-red-700 dark:text-red-400">
                {limitChecks.canAddRecipients.reason}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Timer Settings */}
        <div className="space-y-4">
          <Label>Access Control</Label>
          
          <RadioGroup
            value={formData.timerMode}
            onValueChange={(value: 'creation' | 'verification') => updateField('timerMode', value)}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Card className={`border-2 cursor-pointer transition-all ${
                formData.timerMode === 'verification'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="verification" id="verification" />
                    <Label htmlFor="verification" className="flex items-center gap-2 cursor-pointer">
                      <Clock className="w-4 h-4 text-blue-500" />
                      Time starts after verification
                    </Label>
                    <FeatureBadge feature="custom_time" size="sm" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 ml-6">
                    Recipients get {getTimeLimitDisplay()} after they verify their email
                  </p>
                </CardContent>
              </Card>

              {formData.timerMode === 'verification' && (
                <div className="ml-6 space-y-3">
                  <div className="space-y-2">
                    <Label>Default time limit per recipient</Label>
                    <Select
                      value={formData.defaultTimeLimitHours?.toString() || 'custom'}
                      onValueChange={(value) => updateField('defaultTimeLimitHours', value === 'custom' ? null : parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time limit" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_PRESETS.map((preset) => (
                          <SelectItem key={preset.value || 'custom'} value={preset.value?.toString() || 'custom'}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <FeatureGate feature="custom_time" showUpgradeCard={false}>
                    <div className="space-y-2">
                      <Label>Global expiration (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={formData.verificationDeadline ? formData.verificationDeadline.toISOString().slice(0, -8) : ''}
                        onChange={(e) => updateField('verificationDeadline', e.target.value ? new Date(e.target.value) : undefined)}
                      />
                      <p className="text-xs text-gray-500">
                        Drop becomes inaccessible after this date, regardless of individual timers
                      </p>
                    </div>
                  </FeatureGate>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Card className={`border-2 cursor-pointer transition-all ${
                formData.timerMode === 'creation'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="creation" id="creation" />
                    <Label htmlFor="creation" className="flex items-center gap-2 cursor-pointer">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      Expires at specific time
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 ml-6">
                    Drop expires at a set date/time for everyone
                  </p>
                </CardContent>
              </Card>

              {formData.timerMode === 'creation' && (
                <div className="ml-6 space-y-3">
                  <div className="space-y-2">
                    <Label>Expiry time</Label>
                    <Select
                      value={formData.defaultTimeLimitHours?.toString() || 'custom'}
                      onValueChange={(value) => updateField('defaultTimeLimitHours', value === 'custom' ? null : parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select expiry" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_PRESETS.map((preset) => (
                          <SelectItem key={preset.value || 'custom'} value={preset.value?.toString() || 'custom'}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.defaultTimeLimitHours === null && (
                    <div className="space-y-2">
                      <Label>Custom expiry date and time</Label>
                      <Input
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                        className={errors.customDateTime ? 'border-red-500' : ''}
                      />
                      {errors.customDateTime && (
                        <p className="text-sm text-red-600">{errors.customDateTime}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </RadioGroup>
        </div>

        {/* Send Notifications */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="notifications"
            checked={formData.sendNotifications}
            onCheckedChange={(checked) => updateField('sendNotifications', checked)}
          />
          <Label htmlFor="notifications" className="text-sm">
            Send email notifications to recipients
          </Label>
        </div>

        {/* Subscription Error */}
        {errors.subscription && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-red-700 dark:text-red-400">
              {errors.subscription}
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting || !canProceed || isChecking}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Creating Drop...
            </>
          ) : isChecking ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Checking Limits...
            </>
          ) : !canProceed ? (
            'Upgrade Required'
          ) : (
            'Create Drop'
          )}
        </Button>
      </form>

      <UpgradePromptComponent />
    </>
  )
}