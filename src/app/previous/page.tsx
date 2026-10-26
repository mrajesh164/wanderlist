"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTrips } from "@/app/providers";
import { ButtonLink } from "@/components/Button";
import { Badge, Card, Label } from "@/components/Card";
import { DestinationArt } from "@/components/DestinationArt";
import {
  conditionsOf,
  formatDateRange,
  packedCount,
  phaseOf,
  sortForBoard,
} from "@/lib/trips";
import type { Trip } from "@/lib/types";

/**
 * Trips you've finished.
 *
 * These used to sit under a rule at the bottom of Upcoming, which read as one
 * list with two meanings — the countdown column said "in 3 days" for some rows
 * and "Finished" for others. They're a different question ("what did I take,
 * and should I take it again?") so they get their own tab.
 *
 * Lives at `/previous` rather than `/trips/previous` so it can never be
 * confused with a trip whose id happens to be "previous".
 */

export default function PreviousPage() {
  const { trips, ready } = useTrips();

  const past = useMemo(
    () => (ready ? sortForBoard(trips).filter((t) => phaseOf(t) === "past") : []),
    [ready, trips],
  );

  if (!ready) return <div aria-hidden="true" className="h-64" />;

  if (past.length === 0) {
    return (
      <>
        <h1 className="font-display text-display text-ink">
          No previous
          <br />
          trips yet.
        </h1>
        <p className="measure mt-4 text-body text-ink">
          Once you finish a trip it lands here, with what you packed and a
          one-tap way to pack it again.
        </p>
        <ButtonLink href="/trips" variant="primary" className="mt-5">
          See what&apos;s upcoming
        </ButtonLink>
      </>
    );
  }

  const unreviewed = past.filter((t) => !t.review);

  return (
    <>
      <h1 className="font-display text-heading text-ink">Previous Trips</h1>
      <p className="measure mt-1 text-body text-muted">
        What you took, and what each one taught the next list.
      </p>

      {/* The post-trip reason to come back. */}
      {unreviewed.length > 0 && (
        <Card className="mt-6 border-l-2 border-l-warning">
          <Label>
            {unreviewed.length === 1
              ? "One trip is waiting on a review"
              : `${unreviewed.length} trips are waiting on a review`}
          </Label>
          <p className="measure mt-1 text-body text-ink">
            Two questions about how it went, and the next one packs itself
            better.
          </p>
          <ButtonLink
            href={`/trips/${unreviewed[0].id}/review`}
            variant="primary"
            className="mt-3"
          >
            Review {unreviewed[0].name}
          </ButtonLink>
        </Card>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {past.map((trip) => (
          <PastTrip key={trip.id} trip={trip} />
        ))}
      </ul>
    </>
  );
}

function PastTrip({ trip }: { trip: Trip }) {
  const { packed, total } = packedCount(trip.items);
  const conditions = conditionsOf(trip);
  const retired = trip.learned.drop.length;
  const added = trip.learned.add.length;

  return (
    <li className="flex flex-col border border-rule bg-surface">
      {conditions && (
        <DestinationArt
          seed={trip.destination}
          slug={trip.climateSlug}
          city={trip.destination}
          conditions={conditions}
          height={112}
          className="border-0 border-b border-rule-strong"
        />
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{formatDateRange(trip.startDate, trip.endDate)}</Label>
          {!trip.review && <Badge tone="warning">Not reviewed</Badge>}
        </div>

        <h2 className="mt-1 font-display text-subhead text-ink">
          <Link
            href={`/trips/${trip.id}`}
            className="text-ink no-underline hover:text-accent"
          >
            {trip.name}
          </Link>
        </h2>

        <p className="mt-0.5 text-small text-muted">
          {trip.destination} · {packed} of {total} packed
        </p>

        {(retired > 0 || added > 0) && (
          <p className="mt-2 flex-1 text-small text-ink">
            Taught the next list:{" "}
            {[
              added > 0 && `${added} to add`,
              retired > 0 && `${retired} to drop`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          <ButtonLink href={`/trips/new?from=${trip.id}`} variant="primary">
            Pack this again
          </ButtonLink>
          {!trip.review && (
            <ButtonLink href={`/trips/${trip.id}/review`} variant="secondary">
              Review it
            </ButtonLink>
          )}
        </div>
      </div>
    </li>
  );
}
