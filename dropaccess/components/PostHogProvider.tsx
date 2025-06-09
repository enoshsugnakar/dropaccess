'use client'

import { ReactNode } from 'react'

interface PostHogProviderProps {
  children: ReactNode
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  return <>{children}</>
}

export function usePostHogAnalytics() {
  return {
    trackEvent: () => {},
    trackDropCreated: () => {},
    trackDropAccessed: () => {},
    trackSubscriptionUpgrade: () => {},
    trackFeatureUsed: () => {},
  }
}