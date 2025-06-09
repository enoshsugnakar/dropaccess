import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PostHogProvider } from '@/components/PostHogProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { Navbar } from '@/components/Navbar'

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
      <body className={inter.className}>
        <PostHogProvider>
          <AuthProvider>
            <Navbar />
            <main>
              {children}
            </main>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}