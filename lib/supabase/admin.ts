import { createClient } from '@supabase/supabase-js'

/** Service-role client. Server only. Bypasses row-level security, so check the caller's role first. */
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
