"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button, ButtonLink } from "./Button";
import { WorkedExample } from "./WorkedExample";
import { Label } from "./Card";
import { DestinationArt } from "./DestinationArt";
import { useTrips } from "@/app/providers";
import {
  BAND_LABEL,
  WETNESS_LABEL,
  conditionsFor,
  findClimate,
} from "@/lib/climate";
import { buildPackingList, monthsSpanned } from "@/lib/suggestions";
import { STARTERS, createStarterTrip, starterDates } from "@/lib/starters";
import { formatDateRange } from "@/lib/trips";

/**
 * The first visit.
 *
 * Three ready-made trips, and one tap builds a real one. This is the whole
 * onboarding — there is no tour, no account, and nothing to fill in before you
 * see something worth seeing.
 *
 * The research behind this is in research.md. Short version: every comparable
 * tool fails here. PackPoint traps you on a mandatory creation form (two
 * reviewers report no way out but quitting), TripIt shows an empty list and a
 * corner "+", and Doist's own onboarding deck states the lesson outright —
 * "don't let your users start from a blank page."
 *
 * Each card names what it will actually build ("18 items, including a warm
 * coat"), so the value is legible *before* the tap rather than promised. The
 * dates are real and the list is real; everything is editable afterwards, which
 * the copy says plainly so nobody worries they're committing to something.
 */

export function StarterTrips({
  heading = true,
  /** The board's empty state already offers "Plan a new trip", so it suppresses
      this to avoid stacking three routes to the same place. */
  planLink = true,
}: {
  heading?: boolean;
  planLink?: boolean;
}) {
  const { addTrip } = useTrips();
  const router = useRouter();
  const { isSignedIn } = useAuth();

  /**
   * Signed in, a card builds the list on the spot — Assignment 3's "one tap
   * produces a real list", which is the whole argument for having starters.
   *
   * Signed out it has to be a link instead, because `adopt` writes a row and
   * there is no account to write it to. It used to try anyway: the write was
   * dropped, the navigation bounced off the middleware, and the person landed
   * after sign-up on a trip that had never been saved — "That trip isn't here"
   * as a welcome.
   *
   * `isSignedIn === true` rather than `!isSignedIn` so the brief moment before
   * Clerk resolves takes the link, which works for everyone. Defaulting to the
   * button would put that broken path back for anyone quick on the click.
   */
  const canBuildHere = isSignedIn === true;

  function adopt(key: string) {
    const starter = STARTERS.find((s) => s.key === key);
    if (!starter) return;
    const trip = createStarterTrip(starter);
    addTrip(trip);
    // Straight to the built list — the useful thing, not a confirmation screen.
    router.push(`/trips/${trip.id}`);
  }

  return (
    <div>
      {heading && <Label>Start with one of these</Label>}

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {STARTERS.map((starter) => {
          const { startDate, endDate } = starterDates(starter);
          const climate = findClimate(starter.climateSlug);
          const conditions = climate
            ? conditionsFor(climate, monthsSpanned(startDate, endDate))
            : undefined;

          /* What this actually builds, so the card can say so. Naming the
             conditions beats naming an item: "cool, some rain" explains why the
             list looks the way it does, where "including a jacket" was both
             vague and the same on every card. */
          const items = conditions
            ? buildPackingList(conditions, starter.days)
            : [];

          return (
            <li
              key={starter.key}
              className="flex flex-col border border-rule bg-surface"
            >
              {conditions && (
                <DestinationArt
                  seed={starter.destination}
                  slug={starter.climateSlug}
                  city={starter.destination}
                  conditions={conditions}
                  height={132}
                  className="border-0 border-b border-rule-strong"
                />
              )}

              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-subhead text-ink">
                  {starter.name}
                </h3>

                <p className="mt-1 flex-1 text-small text-ink">
                  {items.length} items
                  {conditions
                    ? ` · ${BAND_LABEL[conditions.band]}, ${WETNESS_LABEL[
                        conditions.wetness
                      ].toLowerCase()}`
                    : ""}
                </p>

                <p className="mt-3 font-sans text-label uppercase text-muted">
                  {formatDateRange(startDate, endDate)} · {starter.destination}
                </p>

                {canBuildHere ? (
                  <Button
                    variant="primary"
                    className="mt-3 w-full"
                    onClick={() => adopt(starter.key)}
                  >
                    Build this list
                  </Button>
                ) : (
                  /* Same words on purpose. The card promised a list; saying
                     "Sign up to build this" here would turn the offer into a
                     toll gate before anyone has decided they want it. The
                     sign-in wall arrives next, with the trip waiting behind
                     it — see /trips/new?starter=. */
                  <ButtonLink
                    variant="primary"
                    className="mt-3 w-full"
                    href={`/trips/new?starter=${starter.key}`}
                  >
                    Build this list
                  </ButtonLink>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {planLink && (
        <p className="mt-6 text-body">
          <Link href="/trips/new" className="text-ink">
            Or plan a specific trip
          </Link>
        </p>
      )}

      {/* The starters prove the tool builds a list. This proves it learns. */}
      <div className="mt-9">
        <WorkedExample />
      </div>
    </div>
  );
}
