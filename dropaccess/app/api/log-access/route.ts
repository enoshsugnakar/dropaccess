import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // This bypasses RLS
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { drop_id, recipient_email, access_granted, user_agent } = body
    
    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip')

    // Insert access log directly (bypasses RLS with service role key)
    const { error } = await supabase
      .from('drop_access_logs')
      .insert({
        drop_id,
        recipient_email,
        accessed_at: new Date().toISOString(),
        ip_address: ip || null,
        user_agent: user_agent || null,
        location: null,
        access_granted: access_granted
      })

    if (error) {
      console.error('Error logging access:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}