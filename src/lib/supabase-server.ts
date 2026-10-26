import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client for route handlers, carrying the caller's Clerk token.
 *
 * Deliberately *not* the service role. The service key bypasses every RLS
 * policy, and having it on disk would undo most of what the deny rule is for.
 * Using the caller's own token means a server-side bug can still only touch
 * rows that caller could touch anyway — the policies stay in force even here.
 */
export async function supabaseForRequest(): Promise<SupabaseClient | null> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { accessToken: async () => token });
}
