import { createClient } from '@supabase/supabase-js'

export const supabasePublic = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false },
  }
)

// Validate service role key format in production
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (serviceRoleKey.includes(' ')) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY contains invalid spaces. Please check your environment variable configuration.')
}

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  serviceRoleKey,
  {
    auth: { persistSession: false },
  }
)


