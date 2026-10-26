import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The one place a service-role key is used, and the only thing it is used for:
 * writing a row into `climate_cache`.
 *
 * **`import "server-only"` is the load-bearing line.** This key bypasses every
 * RLS policy in the project, so the thing that must never happen is it being
 * pulled into a client bundle. That import makes it a build error rather than a
 * silent leak: any component with `"use client"` that imports this file, even
 * transitively, fails the build instead of shipping the key to browsers.
 *
 * The variable deliberately has no `NEXT_PUBLIC_` prefix, which is the other
 * half of the same guarantee — that prefix is what decides whether Next inlines
 * a value into client JavaScript, so a key without it cannot be inlined.
 *
 * Why this exists at all: `/security-review` found that any signed-in user
 * could write arbitrary rows to the shared cache, which every other user then
 * reads. Bounding the values with a check constraint was not enough — tested,
 * and a plausible-but-wrong row still got through. So the public insert policy
 * is gone and the server writes instead, which is what AGENTS.md specified in
 * the first place.
 *
 * Scope discipline: reads still use the caller's own token (`supabase-server.ts`)
 * so RLS stays in force for everything a user can see. This client is only ever
 * reached from the cache-write path in app/api/climate/route.ts.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Null when the key isn't configured. Callers treat that as "can't cache"
 * rather than as an error — the app works without it, it just re-fetches from
 * Open-Meteo more often. That keeps a missing key from taking the feature down,
 * and means this can be deployed before the variable is set.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
