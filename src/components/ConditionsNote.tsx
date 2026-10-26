import { Badge } from "./Card";
import { describeConditions, toF, type Conditions } from "@/lib/climate";
import type { ClimateFetch } from "@/lib/use-climate";

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
 * This app only ever has the second kind, so it says so, every time. That was
 * once forced by Assignment 3's no-API rule; now the numbers come from
 * Open-Meteo's reanalysis archive and the labelling matters more, not less —
 * because there are now three places a number can come from and the person
 * deserves to know which one they're reading.
 */

export function ConditionsNote({
  conditions,
  month,
  destination,
  source,
  live,
}: {
  conditions: Conditions;
  month: string;
  destination: string;
  /** Where the fallback numbers came from. */
  source: "climate" | "manual";
  /** What the live lookup is doing. Absent on screens that don't fetch. */
  live?: ClimateFetch;
}) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          {live?.state === "ok"
            ? `${month} in ${live.place.split(",")[0]}`
            : source === "climate"
              ? `Typical for ${month}`
              : "You told us"}
        </Badge>
        <span className="text-small text-ink">
          {describeConditions(conditions)}
        </span>
      </div>

      {live?.state === "ok" ? (
        <p className="measure mt-1.5 text-small text-muted">
          Averaged from {live.sampleYears} years of recorded weather:{" "}
          <strong className="text-ink">
            {live.highC}°C / {toF(live.highC)}°F
          </strong>{" "}
          by day, down to{" "}
          <strong className="text-ink">
            {live.lowC}°C / {toF(live.lowC)}°F
          </strong>
          , and {live.rainDays} days of rain in a typical {month}. Not a
          forecast — check that closer to your trip.{" "}
          <span className="text-ink-faint">
            {live.source === "cache"
              ? "From this app's cache."
              : "Fetched just now."}{" "}
            Weather data by{" "}
            <a href="https://open-meteo.com" rel="noreferrer noopener">
              Open-Meteo.com
            </a>
            .
          </span>
        </p>
      ) : live?.state === "loading" ? (
        <p className="measure mt-1.5 text-small text-muted">
          Looking up what {month} is usually like in {destination}…
        </p>
      ) : live?.state === "not-found" ? (
        /* The input is the problem, so the fix is theirs to make. */
        <p className="measure mt-1.5 text-small text-muted">
          We couldn&apos;t find <strong className="text-ink">{destination}</strong>{" "}
          on the map, so this list uses{" "}
          {source === "climate" ? "our built-in figures" : "the conditions you picked"}.
          A different spelling, or a nearby larger city, usually works.
        </p>
      ) : live?.state === "unavailable" ? (
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
