"use client";

import { useEffect, useState } from "react";
import type { DayNormal } from "./open-meteo";

/**
 * Real climate normals for a destination, from `/api/climate`.
 *
 * Four states rather than data-or-nothing, because the brief grades a designed
 * screen for each and because they genuinely mean different things:
 *
 *   idle        — nothing to ask about yet
 *   loading     — we're asking; averaging 15 years takes a few seconds cold
 *   ok          — numbers, plus whether they came from cache or the API
 *   not-found   — we can't resolve that destination. The person's input is the
 *                 problem, so the fix is theirs: try a different spelling.
 *   unavailable — we can't reach the weather. Nothing the person can do, so
 *                 don't ask them to retype; fall back and say so quietly.
 *
 * Collapsing the last two into "something went wrong" would be the easy thing
 * and the wrong one — one is a prompt, the other is an apology.
 */

export type ClimateFetch =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ok";
      source: "cache" | "api";
      place: string;
      highC: number;
      lowC: number;
      rainDays: number;
      sampleYears: number;
      /** One entry per day of the month, ascending. */
      days: DayNormal[];
    }
  | { state: "not-found" }
  | { state: "unavailable" };

/**
 * The answer is stored against the question it answers, which does two jobs at
 * once. "Loading" becomes *derived* — it's simply "no answer for this question
 * yet" — so nothing has to setState synchronously inside the effect, which
 * React objects to for good reason. And an answer to a previous question can
 * never be mistaken for the current one, which is the bug you get when the
 * dates are edited twice quickly and the first request resolves second.
 */
type Answer = { question: string; value: ClimateFetch };

export function useClimate(
  destination: string | undefined,
  month: number | undefined,
): ClimateFetch {
  const question =
    destination && month ? `${destination.trim()}|${month}` : null;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!question) return;
    const [place, monthPart] = question.split("|");
    let active = true;

    fetch(
      `/api/climate?place=${encodeURIComponent(place!)}&month=${monthPart}`,
    )
      .then(async (response) => {
        if (response.status === 404) return { state: "not-found" } as const;
        if (!response.ok) return { state: "unavailable" } as const;
        const data = await response.json();
        return {
          state: "ok",
          source: data.source,
          place: data.place,
          highC: data.highC,
          lowC: data.lowC,
          rainDays: data.rainDays,
          sampleYears: data.sampleYears,
          days: data.days ?? [],
        } as ClimateFetch;
      })
      .catch(() => ({ state: "unavailable" }) as const)
      .then((value) => {
        if (active) setAnswer({ question, value });
      });

    return () => {
      active = false;
    };
  }, [question]);

  if (!question) return { state: "idle" };
  return answer?.question === question ? answer.value : { state: "loading" };
}

/**
 * Climate for a whole trip, which may straddle a month boundary.
 *
 * `/api/climate` answers for one place and one month, because that's the shape
 * of the cache key. A trip from 25 November to 1 December needs both, so this
 * asks for each and stitches the per-day arrays into one map.
 *
 * The two requests go in parallel. Each is serial internally — fifteen archive
 * calls, one per year — so two in flight means two concurrent Open-Meteo
 * requests at most, well inside the three that testing showed it tolerates.
 *
 * Partial success is a success. If November resolves and December doesn't, the
 * strip renders November's days and omits December's rather than failing whole,
 * because half a strip is more useful than none and `tripDays` skips any date
 * it has no figures for.
 */
export type TripClimate =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ok";
      place: string;
      sampleYears: number;
      /** Keyed 1–12. */
      byMonth: Map<number, DayNormal[]>;
      /** The monthly aggregate for the trip's first month, which still drives
       *  the band and wetness the packing list is built from. */
      highC: number;
      lowC: number;
      rainDays: number;
    }
  | { state: "not-found" }
  | { state: "unavailable" };

export function useTripClimate(
  destination: string | undefined,
  months: number[],
): TripClimate {
  const question =
    destination && months.length > 0
      ? `${destination.trim()}|${months.join(",")}`
      : null;
  const [answer, setAnswer] = useState<{
    question: string;
    value: TripClimate;
  } | null>(null);

  useEffect(() => {
    if (!question) return;
    const [place, monthList] = question.split("|");
    const wanted = monthList!.split(",").map(Number);
    let active = true;

    Promise.all(
      wanted.map(async (m) => {
        const response = await fetch(
          `/api/climate?place=${encodeURIComponent(place!)}&month=${m}`,
        );
        if (response.status === 404) return { month: m, kind: "not-found" as const };
        if (!response.ok) return { month: m, kind: "unavailable" as const };
        return { month: m, kind: "ok" as const, data: await response.json() };
      }),
    )
      .then((results): TripClimate => {
        const ok = results.filter((r) => r.kind === "ok");
        /* Nothing resolved: report the reason the first month gave, so the UI
           can tell "we don't know that place" from "we can't reach the
           weather" — they are different screens. */
        if (ok.length === 0) {
          return results[0]?.kind === "not-found"
            ? { state: "not-found" }
            : { state: "unavailable" };
        }

        const byMonth = new Map<number, DayNormal[]>();
        for (const r of ok) byMonth.set(r.month, r.data.days ?? []);

        const first = ok[0]!.data;
        return {
          state: "ok",
          place: first.place,
          sampleYears: first.sampleYears,
          byMonth,
          highC: first.highC,
          lowC: first.lowC,
          rainDays: first.rainDays,
        };
      })
      .catch((): TripClimate => ({ state: "unavailable" }))
      .then((value) => {
        if (active) setAnswer({ question, value });
      });

    return () => {
      active = false;
    };
  }, [question]);

  if (!question) return { state: "idle" };
  return answer?.question === question ? answer.value : { state: "loading" };
}
