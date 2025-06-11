'use client'

import { ClientAuthWrapper } from '@/components/ClientAuthWrapper'
import { DropForm } from '@/components/DropForm'

export default function NewDropPage() {
  return (
    <ClientAuthWrapper requireAuth={true}>
      <DropForm />
    </ClientAuthWrapper>
  )
}