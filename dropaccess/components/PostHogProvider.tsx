'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect, ReactNode } from 'react'
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
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
      })
    } else {
      posthog.reset()
    }
  }, [user])

  return <>{children}</>
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

      if (posthogKey) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          capture_pageview: false, // We'll capture manually
          capture_pageleave: true,
          loaded: (posthog) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('PostHog loaded')
            }
          },
        })
      } else {
        console.warn('PostHog key not found. Analytics will not work.')
      }
    }
  }, [])

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  if (!posthogKey) {
    // Return children without PostHog if no key is provided
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

// Custom hook for using PostHog
export function usePostHogAnalytics() {
  const posthog = require('posthog-js')

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && posthog) {
      posthog.capture(eventName, properties)
    }
  }

  const trackDropCreated = (dropType: 'file' | 'url', fileSize?: number) => {
    trackEvent('drop_created', {
      drop_type: dropType,
      file_size_mb: fileSize ? Math.round(fileSize / (1024 * 1024) * 100) / 100 : undefined,
    })
  }

  const trackDropAccessed = (dropId: string, recipientEmail: string) => {
    trackEvent('drop_accessed', {
      drop_id: dropId,
      recipient_email: recipientEmail,
    })
  }

  const trackSubscriptionUpgrade = (fromPlan: string, toPlan: string) => {
    trackEvent('subscription_upgrade', {
      from_plan: fromPlan,
      to_plan: toPlan,
    })
  }

  const trackFeatureUsed = (featureName: string, metadata?: Record<string, any>) => {
    trackEvent('feature_used', {
      feature_name: featureName,
      ...metadata,
    })
  }

  return {
    trackEvent,
    trackDropCreated,
    trackDropAccessed,
    trackSubscriptionUpgrade,
    trackFeatureUsed,
  }
}