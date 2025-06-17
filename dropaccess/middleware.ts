// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { subscriptionMiddleware } from './middleware/subscriptionMiddleware'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })

  // Refresh session if expired - required for Server Components
  await supabase.auth.getSession()

  // Apply subscription middleware to protected routes
  if (request.nextUrl.pathname.startsWith('/analytics') ||
      request.nextUrl.pathname.startsWith('/branding') ||
      request.nextUrl.pathname.startsWith('/team') ||
      request.nextUrl.pathname.includes('/admin')) {
    return subscriptionMiddleware(request)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}