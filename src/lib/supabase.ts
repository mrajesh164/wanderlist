"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client that carries the signed-in person's Clerk token.
 *
 * This is the hinge the whole data model turns on. Every RLS policy compares
 * `auth.jwt() ->> 'sub'` against `user_id`, and `accessToken` below is what
 * puts a Clerk session token where Postgres can read that claim. There is no
 * JWT translation and no second token exchange — Supabase verifies Clerk's
 * token directly, which is what the third-party auth integration configures.
 *
 * If the Clerk side is ever disconnected, nothing here errors: the token stops
 * carrying a recognised issuer, `sub` resolves to null, every policy matches
 * nothing, and the app looks *empty*. Rule that out first when rows vanish.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/* Supabase renamed the anon key to "publishable key". Accept either, because
   which one is in .env.local depends on when it was copied out of the
   dashboard, and a silently-undefined key is a miserable thing to debug. */
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Names what's missing rather than failing silently. Surfaced in the UI, so a
 * misnamed variable reads as "the app isn't configured" and not as "your
 * trips are gone".
 */
export const supabaseConfigError: string | null = !SUPABASE_URL
  ? "NEXT_PUBLIC_SUPABASE_URL is not set"
  : !SUPABASE_KEY
    ? "Neither NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set"
    : null;

/**
 * Null while signed out, or when the configuration is incomplete. Callers
 * treat null as "no data to load" rather than as an error — signed out is a
 * legitimate state, not a failure.
 */
export function useSupabase(): SupabaseClient | null {
  const { session } = useSession();

  return useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY || !session) return null;

    return createClient(SUPABASE_URL, SUPABASE_KEY, {
      accessToken: async () => (await session.getToken()) ?? null,
    });
    /* Keyed on session id rather than the session object: Clerk hands back a
       new object as the token refreshes, and rebuilding the client on every
       refresh would retrigger every query that depends on it. */
  }, [session]);
}
