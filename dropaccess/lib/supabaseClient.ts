import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Service role client for server-side operations (bypasses RLS)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Your existing interfaces...
export interface User {
  id: string
  email: string
  is_paid: boolean
  created_at: string
}

export interface Drop {
  id: string
  owner_id: string
  name: string
  drop_type: 'file' | 'url'
  file_path?: string
  masked_url?: string
  expires_at: string
  created_at: string
}

export interface DropRecipient {
  id: string
  drop_id: string
  email: string
  accessed_at?: string
  access_count: number
}

export interface DropAccessLog {
  id: string
  drop_id: string
  recipient_email: string
  accessed_at: string
  ip_address: string
  user_agent: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: string
  status: string
  started_at: string
  expires_at: string
}