import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Lazily creates a singleton Supabase client using the read-only anon/publishable
 * key. The `editorial` table only grants a `SELECT` RLS policy to the anon role
 * (see `editorial_public_select`), so this client can never write regardless of
 * what the application code does.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. " +
        "Set them in .env.local (dev) or the Vercel project settings (production).",
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
