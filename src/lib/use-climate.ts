"use client";

import { useEffect, useState } from "react";

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
