import { createClient } from '@supabase/supabase-js';

/** Service-role client for server-only jobs. Bypasses RLS: never expose to the browser. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A hand-off id: SHA-256 hex of the app's secret. */
export const isHandoffHash = (v: string | null): v is string => !!v && /^[a-f0-9]{64}$/.test(v);
