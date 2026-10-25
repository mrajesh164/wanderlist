"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";

/**
 * The masthead: a wordmark that's always home, and — once you're signed in —
 * three tabs that say what this thing is for.
 *
 * The tabs carry the navigation requirement — it's clear where you are and how
 * to get back — and they give the app a readable shape: the trips you have,
 * adding one, and everything the tool has learned about what you pack.
 *
 * **Signed out, the tabs are hidden rather than disabled.** Every one of them
 * redirects to sign-in, so showing them advertises four destinations and then
 * refuses all four — a menu of locked doors, which is the dead-end screen this
 * app is supposed to be the opposite of. Signed out you get a way in instead,
 * and home explains what the app is.
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

        {/* One boundary for the whole right-hand side. Tabs and auth controls
            both wait on the same answer, so splitting them into two boundaries
            made the masthead settle in two visible stages. The fallback holds
            the row's height so nothing below it jumps. */}
        <Suspense fallback={<div aria-hidden="true" className="h-10" />}>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <Show when="signed-in">
              <Suspense fallback={<TabList active={null} />}>
                <Tabs />
              </Suspense>
              <AccountMenu />
            </Show>
            <Show when="signed-out">
              <WayIn />
            </Show>
          </div>
        </Suspense>
      </div>
    </header>
  );
}

/**
 * Signed out: the two things worth offering. Plain links rather than Clerk's
 * button components, because the routes already exist and Café Terrace wants
 * its own type, not a vendor's.
 */
function WayIn() {
  return (
    <nav aria-label="Account" className="mb-3 flex items-center gap-4">
      <Link href="/sign-in" className="font-sans text-small text-ink hover:text-accent">
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="font-sans text-small font-semibold text-accent hover:text-ink"
      >
        Create an account
      </Link>
    </nav>
  );
}

/**
 * Clerk's avatar is a circle by default, which Café Terrace doesn't permit —
 * border radius is 0, controls may use 2px. Squared off to match.
 */
function AccountMenu() {
  return (
    <div className="mb-2.5 flex items-center">
      <UserButton
        appearance={{
          elements: {
            avatarBox: "rounded-none size-7",
            userButtonPopoverCard: "rounded-none",
          },
        }}
      />
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
