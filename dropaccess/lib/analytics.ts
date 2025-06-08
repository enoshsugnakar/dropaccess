// lib/analytics.ts
import posthog from 'posthog-js'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://app.posthog.com',
    capture_pageview: false // We'll capture manually
  })
}

export const trackEvent = (event: string, properties?: any) => {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}

// Track everything for free
export const trackDropCreated = (dropType: string, recipientCount: number) => {
  trackEvent('drop_created', {
    drop_type: dropType,
    recipient_count: recipientCount,
    plan: user?.subscription_tier || 'free'
  })
}

export const trackDropAccessed = (dropId: string, accessMethod: string) => {
  trackEvent('drop_accessed', {
    drop_id: dropId,
    access_method: accessMethod
  })
}