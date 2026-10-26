"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { useTrips } from "@/app/providers";

/**
 * Put the app back to a true first visit.
 *
 * This is here for a specific reason: there is otherwise no way to see the
 * onboarding again once you've saved a single trip — not for the person who
 * built it, and not for anyone being shown it. The first visit becomes
 * unreachable the moment it succeeds.
 *
 * Behind a confirm, because it genuinely deletes everything. Note what that
 * now means: Assignment 3 deleted one browser's localStorage, and a private
 * window got you a clean slate either way. This deletes rows from the
 * database, for the whole account, on every device — so the confirmation has
 * to say so. It said "from this browser" for a while after the port, which was
 * the old sentence describing the new behaviour, and understated it.
 */

export function ResetFirstVisit() {
  const { trips, kit, ready, resetEverything } = useTrips();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  // Nothing to reset, and no point advertising it on a true first visit.
  if (!ready || (trips.length === 0 && kit.length === 0)) return null;

  if (!confirming) {
    return (
      <p className="text-small text-muted">
        <Button variant="quiet" onClick={() => setConfirming(true)}>
          Reset to first visit
        </Button>
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label="Confirm reset"
      className="flex flex-wrap items-center gap-3"
    >
      <p className="measure text-small text-ink">
        This deletes {trips.length}{" "}
        {trips.length === 1 ? "trip" : "trips"}
        {kit.length > 0
          ? ` and ${kit.length} inventory ${kit.length === 1 ? "item" : "items"}`
          : ""}{" "}
        from your account, on every device you sign in on. It can&apos;t be
        undone.
      </p>
      <Button
        ref={confirmRef}
        variant="danger"
        onClick={() => {
          resetEverything();
          setConfirming(false);
          router.push("/");
        }}
      >
        Delete everything
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </div>
  );
}
