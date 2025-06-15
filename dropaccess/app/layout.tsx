import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PostHogProvider } from '@/components/PostHogProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { Navbar } from '@/components/Navbar'
import { Toaster } from 'react-hot-toast'
import { SubscriptionProvider } from '@/components/SubscriptionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DropAccess - Secure Time-Gated Content Sharing',
  description: 'Share files and URLs securely with time-based access control',
  icons: {
    icon: [
      {
        url: '/dropaccess_icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SubscriptionProvider>
            <PostHogProvider>
              {children}
            </PostHogProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  )
}