'use client'

import { PostHogProvider } from '@/components/PostHogProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { Navbar } from '@/components/Navbar'
import { ReactNode } from 'react'

interface ClientProvidersProps {
  children: ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PostHogProvider>
      <AuthProvider>
        <Navbar />
        <main className="pt-16">
          {children}
        </main>
      </AuthProvider>
    </PostHogProvider>
  )
}