import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseForRequest } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ClimateUnavailable,
  fetchNormals,
  geocode,
  placeKey,
} from "@/lib/open-meteo";

/**
 * What a month is typically like at a place.
 *
 * **This is the answer to "where do you call the API, and why there".** It runs
 * on the server, not in the browser, for a reason that is specific rather than
 * reflexive: the normals for March in Lisbon are identical for every user on
 * the planet, so one fetch should serve everybody. Calling it from the browser
 * would mean every visitor re-fetching the same fifteen years of weather.
 *
 * The free tier makes that concrete rather than theoretical — it returned 429
 * after about ten calls from a shared campus IP, and Open-Meteo's own terms
 * warn that platforms like Vercel get throttled early because their addresses
 * are shared. Averaging fifteen years takes fifteen requests, so without the
 * cache the second person to look up a city would be rate-limited.
 *
 * GET /api/climate?place=Lisbon&month=3
 *
 * Three outcomes, deliberately distinguishable, because the brief wants a
 * designed state for each:
 *   200 → { source: "cache" | "api", ...normals }
 *   404 → { error: "not-found" }     we can't resolve that place
 *   503 → { error: "unavailable" }   we can't reach the weather
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "signed-out" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const place = params.get("place")?.trim() ?? "";
  const month = Number(params.get("month"));

  if (!place || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "bad-request", detail: "place and month (1-12) are required" },
      { status: 400 },
    );
  }

  const supabase = await supabaseForRequest();
  if (!supabase) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  /* Geocode first: the cache is keyed on coordinates, not on the string that
     was typed, so "Lisbon" and "lisbon, portugal" share one row. One geocode
     is cheap; fifteen archive calls are not. */
  let resolved;
  try {
    resolved = await geocode(place);
  } catch (cause) {
    if (cause instanceof ClimateUnavailable) {
      return NextResponse.json(
        { error: "unavailable", detail: cause.message },
        { status: 503 },
      );
    }
    throw cause;
  }

  if (!resolved) {
    return NextResponse.json({ error: "not-found", place }, { status: 404 });
  }

  const key = placeKey(resolved.lat, resolved.lon);

  const cached = await supabase
    .from("climate_cache")
    .select("high_c, low_c, rain_days, sample_years, label, fetched_at, days")
    .eq("place_key", key)
    .eq("month", month)
    .maybeSingle();

  /* A row cached before the per-day column existed has no `days` to infer, so
     it is treated as a miss and refetched rather than served short. The refetch
     writes through the service role, which can update as well as insert. */
  if (cached.data && Array.isArray(cached.data.days)) {
    return NextResponse.json({
      source: "cache",
      place: cached.data.label ?? resolved.label,
      placeKey: key,
      month,
      highC: Number(cached.data.high_c),
      lowC: Number(cached.data.low_c),
      rainDays: Number(cached.data.rain_days),
      sampleYears: cached.data.sample_years,
      days: cached.data.days,
      fetchedAt: cached.data.fetched_at,
    });
  }

  let normals;
  try {
    normals = await fetchNormals(resolved.lat, resolved.lon, month);
  } catch (cause) {
    if (cause instanceof ClimateUnavailable) {
      return NextResponse.json(
        { error: "unavailable", detail: cause.message },
        { status: 503 },
      );
    }
    throw cause;
  }

  /* The write goes through the service role, not the caller's token. Clients
     cannot write this table at all — `/security-review` found that letting them
     meant any account holder could change what every other account holder is
     told to pack, permanently. See lib/supabase-admin.ts.

     A failed write is not a failed request. The numbers are already in hand,
     and the only cost of not caching them is doing the work again — so the
     caller gets their answer either way. Two cases are expected rather than
     exceptional: losing a race to another user asking for the same city, and
     the service key not being configured at all, which simply means no cache. */
  const admin = supabaseAdmin();
  /* upsert rather than insert: a row cached before the per-day column existed
     is refetched above, and inserting over it would collide on the primary
     key. */
  const written = admin
    ? await admin.from("climate_cache").upsert(
        {
          place_key: key,
          month,
          high_c: normals.highC,
          low_c: normals.lowC,
          rain_days: normals.rainDays,
          sample_years: normals.sampleYears,
          days: normals.days,
          label: resolved.label,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "place_key,month" },
      )
    : null;

  return NextResponse.json({
    source: "api",
    place: resolved.label,
    placeKey: key,
    month,
    ...normals,
    cached: written !== null && written.error === null,
  });
}
