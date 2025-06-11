'use client'

import { ClientProviders } from '@/components/ClientProviders'
import { ReactNode } from 'react'

interface TemplateProps {
  children: ReactNode
}

export default function Template({ children }: TemplateProps) {
  return (
    <ClientProviders>
      {children}
    </ClientProviders>
  )
}