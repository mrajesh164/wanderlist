"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TripForm } from "@/components/TripForm";
import { useTrips } from "@/app/providers";

/**
 * Add a trip — or repeat one. `?from=<id>` prefills from a finished trip and
 * carries its corrections forward, which is the whole "trips you repeat" idea:
 * the second time you pack something, you shouldn't start from scratch.
 *
 * useSearchParams needs a Suspense boundary so the route can still be
 * prerendered as a static shell under cacheComponents.
 */

export default function NewTripPage() {
  return (
    <Suspense fallback={<Heading repeating={false} />}>
      <NewTrip />
    </Suspense>
  );
}

function NewTrip() {
  const params = useSearchParams();
  const { trips, ready } = useTrips();

  const from = params.get("from");
  const repeatOf = from ? trips.find((t) => t.id === from) : undefined;

  /**
   * Wait for the first load before showing the form at all.
   *
   * This used to be `if (from && !ready)` — guarding only the repeat case, so a
   * reload of `?from=…` couldn't quietly become a blank new trip. The Playwright
   * test found the hole in that: the form rendered while the Supabase client was
   * still being built, so a trip submitted in that window was dropped. `addTrip`
   * wrote it optimistically, `write()` found no client and returned silently,
   * and the in-flight initial fetch then replaced local state — so the trip
   * vanished from the screen *and* never reached the database. "That trip isn't
   * here" was the result.
   *
   * Guarding unconditionally matches what `/trips/[id]` and `/inventory` already
   * do, and costs only a placeholder on a cold load.
   */
  if (!ready) return <Heading repeating={Boolean(from)} />;

  return (
    <>
      <Heading repeating={Boolean(repeatOf)} />
      <TripForm repeatOf={repeatOf} />
    </>
  );
}

function Heading({ repeating }: { repeating: boolean }) {
  return (
    <>
      <h1 className="font-display text-heading text-ink">
        {repeating ? "Pack it again" : "A new trip"}
      </h1>
      <p className="measure mb-8 mt-1 text-body text-muted">
        The dates and the destination are all we need — the list builds itself
        from there.
      </p>
    </>
  );
}
