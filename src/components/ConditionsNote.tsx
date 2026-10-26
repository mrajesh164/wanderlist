import { Badge } from "./Card";
import { ConditionsStrip } from "./ConditionsStrip";
import { describeConditions, type Conditions } from "@/lib/climate";
import { tripDays } from "@/lib/trip-days";
import type { TripClimate } from "@/lib/use-climate";

/**
 * What the weather is expected to do, and — just as importantly — where that
 * expectation came from.
 *
 * Researching comparable tools turned this into a deliberate decision rather
 * than an afterthought. PackPoint fetches a live forecast and silently falls
 * back to climate averages when one isn't available; its v2 release notes say
 * the cards had to start *labelling* which of the two you were looking at.
 * That's the whole lesson: a packing list that quietly mixes "it will rain on
 * Tuesday" with "it usually rains in March" is a list you stop trusting.
 *
 * Everything here is the second kind, and it says so once — in the strip's own
 * header — rather than repeating a disclaimer per day.
 *
 * This used to be a paragraph describing the month. A sentence like "Cold,
 * 31–44°F, some rain" is true of December in New York and tells you nothing
 * about whether the 10th differs from the 17th. The strip shows the shape of
 * the actual dates, which is what you pack from; the sentence stays as a
 * one-line summary above it, because the band and wetness it names are what
 * the list was generated from.
 */

export function ConditionsNote({
  conditions,
  month,
  destination,
  source,
  live,
  startDate,
  endDate,
}: {
  conditions: Conditions;
  month: string;
  destination: string;
  /** Where the fallback numbers came from, when the lookup can't answer. */
  source: "climate" | "manual";
  live: TripClimate;
  startDate: string;
  endDate: string;
}) {
  const days =
    live.state === "ok" ? tripDays(startDate, endDate, live.byMonth) : [];

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          {live.state === "ok"
            ? `${month} in ${live.place.split(",")[0]}`
            : source === "climate"
              ? `Typical for ${month}`
              : "You told us"}
        </Badge>
        <span className="text-small text-ink">
          {describeConditions(conditions)}
        </span>
      </div>

      {live.state === "ok" && days.length > 0 ? (
        <ConditionsStrip
          days={days}
          sampleYears={live.sampleYears}
          place={live.place}
        />
      ) : live.state === "loading" ? (
        <p className="measure mt-1.5 text-small text-muted">
          Looking up what these dates are usually like in {destination}…
        </p>
      ) : live.state === "not-found" ? (
        /* The input is the problem, so the fix is theirs to make. */
        <p className="measure mt-1.5 text-small text-muted">
          We couldn&apos;t find <strong className="text-ink">{destination}</strong>{" "}
          on the map, so this list uses{" "}
          {source === "climate" ? "our built-in figures" : "the conditions you picked"}.
          A different spelling, or a nearby larger city, usually works.
        </p>
      ) : live.state === "unavailable" ? (
        /* Nothing the person can do about this one, so don't ask them to act.
           The hardcoded table stops being dead weight and becomes the graceful
           degradation path. */
        <p className="measure mt-1.5 text-small text-muted">
          The weather service didn&apos;t answer, so this list is built from our
          built-in figures for {month}. Everything still works; the numbers are
          just approximate.
        </p>
      ) : (
        <p className="measure mt-1.5 text-small text-muted">
          {source === "climate" ? (
            <>
              Based on what {destination} weather is typically like in {month},
              not a forecast. Check the forecast closer to your trip.
            </>
          ) : (
            <>
              We don&apos;t have climate data for {destination}, so this list is
              built from the conditions you picked.
            </>
          )}
        </p>
      )}
    </div>
  );
}
