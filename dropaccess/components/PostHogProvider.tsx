'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect, ReactNode, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from './AuthProvider'

interface PostHogProviderProps {
  children: ReactNode
}

function PostHogPageView(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams])

  return null
}

function PostHogAuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const auth = useAuth() // Call useAuth unconditionally at the top level
  const user = auth?.user || null // Handle cases where auth might be undefined

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only run this effect on the client side after mounting
    if (!mounted) return

    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        user_id: user.id,
        created_at: user.created_at,
      })
    } else {
      posthog.reset()
    }
  }, [user, mounted])

  return <>{children}</>
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && mounted) {
      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

      if (posthogKey) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          capture_pageview: false, // We'll capture manually
          capture_pageleave: true,
          disable_session_recording: false,
          disable_cookie: false,
          persistence: 'localStorage+cookie',
          autocapture: true,
          loaded: (posthog) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('PostHog loaded successfully')
              posthog.debug()
            }
          },
          bootstrap: {
            distinctID: undefined,
          },
        })
      } else {
        console.warn('PostHog key not found. Analytics will not work.')
      }
    }
  }, [mounted])

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  // Don't render anything during SSR
  if (!mounted) {
    return <>{children}</>
  }

  if (!posthogKey) {
    // Return children without PostHog if no key is provided
    console.warn('NEXT_PUBLIC_POSTHOG_KEY not set, running without analytics')
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <PostHogAuthProvider>
        <PostHogPageView />
        {children}
      </PostHogAuthProvider>
    </PHProvider>
  )
}

// Custom hook for using PostHog analytics
export function usePostHogAnalytics() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && mounted && posthog) {
      posthog.capture(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
        page_url: window.location.href,
        page_title: document.title,
      })
    }
  }

  const identifyUser = (userId: string, traits?: Record<string, any>) => {
    if (typeof window !== 'undefined' && mounted && posthog) {
      posthog.identify(userId, traits)
    }
  }

  const setUserProperties = (properties: Record<string, any>) => {
    if (typeof window !== 'undefined' && mounted && posthog) {
      posthog.setPersonProperties(properties)
    }
  }

  // Drop-specific tracking events
  const trackDropCreated = (dropType: 'file' | 'url', metadata?: {
    fileSize?: number
    recipients?: number
    expiryHours?: number
    hasPassword?: boolean
  }) => {
    trackEvent('drop_created', {
      drop_type: dropType,
      file_size_mb: metadata?.fileSize ? Math.round(metadata.fileSize / (1024 * 1024) * 100) / 100 : undefined,
      recipient_count: metadata?.recipients,
      expiry_hours: metadata?.expiryHours,
      has_password: metadata?.hasPassword,
    })
  }

  const trackDropAccessed = (dropId: string, metadata?: {
    recipientEmail?: string
    accessMethod?: 'email' | 'direct'
    userAgent?: string
  }) => {
    trackEvent('drop_accessed', {
      drop_id: dropId,
      recipient_email: metadata?.recipientEmail,
      access_method: metadata?.accessMethod,
      user_agent: metadata?.userAgent,
    })
  }

  const trackDropDownloaded = (dropId: string, metadata?: {
    fileType?: string
    fileSize?: number
    downloadTime?: number
  }) => {
    trackEvent('drop_downloaded', {
      drop_id: dropId,
      file_type: metadata?.fileType,
      file_size_mb: metadata?.fileSize ? Math.round(metadata.fileSize / (1024 * 1024) * 100) / 100 : undefined,
      download_time_ms: metadata?.downloadTime,
    })
  }

  // Subscription tracking events
  const trackSubscriptionUpgrade = (fromPlan: string, toPlan: string, metadata?: {
    amount?: number
    paymentMethod?: string
    currency?: string
  }) => {
    trackEvent('subscription_upgrade', {
      from_plan: fromPlan,
      to_plan: toPlan,
      amount_cents: metadata?.amount,
      payment_method: metadata?.paymentMethod,
      currency: metadata?.currency || 'USD',
    })
  }

  const trackSubscriptionCanceled = (plan: string, reason?: string) => {
    trackEvent('subscription_canceled', {
      plan,
      cancellation_reason: reason,
    })
  }

  const trackPaymentFailed = (plan: string, errorCode?: string, errorMessage?: string) => {
    trackEvent('payment_failed', {
      plan,
      error_code: errorCode,
      error_message: errorMessage,
    })
  }

  // Feature usage tracking
  const trackFeatureUsed = (featureName: string, metadata?: Record<string, any>) => {
    trackEvent('feature_used', {
      feature_name: featureName,
      ...metadata,
    })
  }

  const trackButtonClick = (buttonName: string, location: string, metadata?: Record<string, any>) => {
    trackEvent('button_clicked', {
      button_name: buttonName,
      location,
      ...metadata,
    })
  }

  const trackFormSubmitted = (formName: string, success: boolean, errors?: string[]) => {
    trackEvent('form_submitted', {
      form_name: formName,
      success,
      errors: errors?.join(', '),
    })
  }

  // User journey tracking
  const trackUserSignUp = (method: 'email' | 'google' | 'github', metadata?: Record<string, any>) => {
    trackEvent('user_sign_up', {
      signup_method: method,
      ...metadata,
    })
  }

  const trackUserSignIn = (method: 'email' | 'google' | 'github', metadata?: Record<string, any>) => {
    trackEvent('user_sign_in', {
      signin_method: method,
      ...metadata,
    })
  }

  const trackUserOnboarding = (step: string, completed: boolean, metadata?: Record<string, any>) => {
    trackEvent('user_onboarding', {
      onboarding_step: step,
      completed,
      ...metadata,
    })
  }

  // Error tracking
  const trackError = (errorType: string, errorMessage: string, metadata?: Record<string, any>) => {
    trackEvent('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      ...metadata,
    })
  }

  // Performance tracking
  const trackPerformance = (metricName: string, value: number, unit: string) => {
    trackEvent('performance_metric', {
      metric_name: metricName,
      value,
      unit,
    })
  }

  // Page-specific tracking
  const trackPageView = (pageName: string, metadata?: Record<string, any>) => {
    trackEvent('page_viewed', {
      page_name: pageName,
      ...metadata,
    })
  }

  const trackTimeOnPage = (pageName: string, timeSeconds: number) => {
    trackEvent('time_on_page', {
      page_name: pageName,
      time_seconds: timeSeconds,
    })
  }

  return {
    // Core tracking
    trackEvent,
    identifyUser,
    setUserProperties,
    
    // Drop-specific
    trackDropCreated,
    trackDropAccessed,
    trackDropDownloaded,
    
    // Subscription
    trackSubscriptionUpgrade,
    trackSubscriptionCanceled,
    trackPaymentFailed,
    
    // Feature usage
    trackFeatureUsed,
    trackButtonClick,
    trackFormSubmitted,
    
    // User journey
    trackUserSignUp,
    trackUserSignIn,
    trackUserOnboarding,
    
    // Error & Performance
    trackError,
    trackPerformance,
    
    // Page tracking
    trackPageView,
    trackTimeOnPage,
  }
}

// Helper function to track page time
export function usePageTimeTracking(pageName: string) {
  const { trackTimeOnPage } = usePostHogAnalytics()
  
  useEffect(() => {
    const startTime = Date.now()
    
    const handleBeforeUnload = () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      trackTimeOnPage(pageName, timeSpent)
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      trackTimeOnPage(pageName, timeSpent)
    }
  }, [pageName, trackTimeOnPage])
}

// TypeScript declarations for global PostHog
declare global {
  interface Window {
    posthog?: typeof posthog
  }
}

export default PostHogProvider