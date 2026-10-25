"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";

/**
 * The masthead: a wordmark that's always home, and three tabs that say what
 * this thing is for.
 *
 * The tabs carry the navigation requirement — it's clear where you are and how
 * to get back — and they give the app a readable shape: the trips you have,
 * adding one, and everything the tool has learned about what you pack.
 *
 * Tabs sit behind a Suspense boundary because `usePathname` suspends on
 * /trips/[id], whose param isn't known at build time. Without it, that one hook
 * would drag the whole layout out of prerendering.
 */

const TABS = [
  { href: "/trips/new", label: "New trip" },
  { href: "/trips", label: "Upcoming" },
  { href: "/previous", label: "Previous" },
  { href: "/inventory", label: "Inventory" },
] as const;

export function Nav() {
  return (
    <header className="border-b-2 border-ink bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 pt-4">
        <Link
          href="/"
          className="mb-3 font-display text-subhead font-semibold tracking-tight text-ink no-underline hover:text-accent"
        >
          Wanderlist
        </Link>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <Suspense fallback={<TabList active={null} />}>
            <Tabs />
          </Suspense>
          <AuthControls />
        </div>
      </div>
    </header>
  );
}

/**
 * Sign in, or the account menu once you're in.
 *
 * Behind its own Suspense boundary because `<Show>` reads the request. The
 * fallback reserves the same height so the masthead doesn't reflow when auth
 * state resolves — the tabs would otherwise jump sideways on every load.
 *
 * Clerk's avatar is a circle by default, which Café Terrace doesn't permit
 * (border radius is 0, controls may use 2px). Squared off to match.
 */
function AuthControls() {
  return (
    <div className="mb-2.5 flex items-center">
      <Suspense fallback={<div aria-hidden="true" className="h-7 w-7" />}>
        <Show when="signed-out">
          <Link
            href="/sign-in"
            className="font-sans text-small text-accent hover:text-ink"
          >
            Sign in
          </Link>
        </Show>
        <Show when="signed-in">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "rounded-none size-7",
                userButtonPopoverCard: "rounded-none",
              },
            }}
          />
        </Show>
      </Suspense>
    </div>
  );
}

function Tabs() {
  const pathname = usePathname();

  /* A trip or its review belongs to Upcoming — that's where you came from,
     so that's the section you're in. */
  const active =
    pathname === "/trips/new"
      ? "/trips/new"
      : pathname.startsWith("/inventory")
        ? "/inventory"
        : pathname.startsWith("/previous")
          ? "/previous"
          : pathname.startsWith("/trips")
            ? "/trips"
            : null;

  return <TabList active={active} />;
}

function TabList({ active }: { active: string | null }) {
  return (
    <nav aria-label="Sections" className="-mb-0.5 flex gap-1">
      {TABS.map((tab) => {
        const selected = active === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={`border-b-[3px] px-3 pb-2.5 pt-1 font-sans text-small no-underline ${
              selected
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
