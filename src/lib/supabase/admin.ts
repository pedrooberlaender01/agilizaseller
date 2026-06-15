import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service_role key.
 *
 * ⚠️ USAR APENAS EM SERVER ACTIONS / ROUTE HANDLERS.
 * Service role bypassa RLS — jamais expor no client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
