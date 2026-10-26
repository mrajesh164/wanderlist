<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wanderlist

Packing lists for your favorite destinations. You keep the trips you take again in one place
— "Thanksgiving at my parents'", "Ann Arbor for a game weekend", "Lisbon in March"
— and each time one comes around, the list is already built, already corrected by
the last time you took it, and already adjusted for how long you're going and what
the weather does there that month.

Course: Design, Build, Ship · MPCS 51238 · Assignment 4 (Full Stack App).
Due Tuesday, October 27 2026, 5:30 PM. Assignment 3's work is on `main`; this
branch adds accounts, a database and one external API on top of it.

## The three flows

The assignment is organized around three flows. Every design decision should serve one.

**1. First visit** — nothing in storage. There is nothing to show, so instead of an empty
screen it offers three ready-made trips to adopt ("A weekend at home", "A week
somewhere warm", "Three days for a conference"). One tap produces a real trip with a real
packing list. The person learns what the tool is by using it, not
by reading a tour.

**2. The core task** — written as one sentence:

> I add a trip → it builds a packing list from the dates and the destination → I check things off as I pack → I come back next time and it's already corrected from last trip.

**3. Coming back** — three reasons, on three clocks:
- *Mid-pack:* packing happens over several evenings, so a part-packed list is a
  standing invitation to come back and finish it.
- *Before the trip:* home and Upcoming both lead with the next departure and what's still unpacked ("Lisbon, in 3 days — 7 items left").
- *After the trip:* a short review marks what you never used and what you wished
  you'd brought. Those corrections are applied the next time you pack that trip.
  The list measurably improves each time you return.

## Shape of the app

Four tabs in the masthead, which is what gives the tool a legible purpose. New trip leads
because starting one is what people arrive to do; the rest are views onto trips that
already exist.

| Tab | Route | What it is |
|---|---|---|
| — | `/` | Home, with two faces. **A true first visit lands here and the onboarding *is* this page** — three ready-made trips or your own, one tap to a real list. Returning, it says "Welcome Back" and leads with the next departure. |
| New trip | `/trips/new` | The form. Also serves `?from=<id>` to repeat a finished trip with its corrections applied. |
| Upcoming | `/trips` | Upcoming trips only, soonest first. Starters on a true first visit. |
| Previous | `/previous` | Finished trips: what was packed, what each taught the next list, and "Pack this again". Lives at `/previous`, not `/trips/previous`, so it can't collide with a trip id. |
| Inventory | `/inventory` | Things you list yourself (`kit` in storage) merged with everything trips reveal. Every row carries a quantity and a stepper to set it. Sorts by Packed most, or filters to Never used. Also lists what you took per finished trip. |

A trip (`/trips/[id]`) and its review belong to the Upcoming tab, since that's
where you came from.

**The first visit lives in `components/StarterTrips.tsx`**, rendered by both `/`
and `/trips` so neither entry point can dead-end. It carries
`components/WorkedExample.tsx` — a trip already packed twice, with its
corrections shown inline. That exists because the correction loop is the only
thing this tool does that a notes app doesn't, and it's the one thing a first
visit can't otherwise show: it takes two trips to happen. The example is built
by `lib/example.ts`, flagged `isExample`, badged wherever it appears, and
deletable like any other trip. The `data-when` CSS gate (see
`globals.css`) now applies to home. `components/ResetFirstVisit.tsx` in the
footer exists because otherwise the onboarding becomes unreachable the moment it
succeeds — there's no other way to see it again on the same device.

**Adding an item does three things at once** (`addItem` in `providers.tsx`): it
joins the trip, joins `learned.add` so the next run of that trip starts with it,
and joins your inventory. If you packed it, you own it. The add form can also
pull straight *from* the inventory, which is what keeps that page from being a
read-only report.

**Inventory is mostly derived.** `src/lib/inventory.ts` aggregates `trip.items`
plus `trip.learned` across all trips, then merges in `state.kit` — the things
someone listed directly. Keep that split: trips remain the source of truth for
what has been *packed*, and `kit` only adds what hasn't been packed yet.

**Every inventory row has a quantity, and they're not equally trustworthy.**
`KitEntry.qtySource` says which kind a number is, and `resolveQty` picks it in
this order:

| Source | Where the number comes from | Trust |
| --- | --- | --- |
| `counted` | `KitItem.qty` — the **How many** field, the row's stepper, or the 1 both default to | True |
| `inferred` | `packedMax`, the most ever ticked off a list at once | A floor |
| `assumed` | `1`, because it's been on a list but never ticked | None |

**The number is `max(counted, packedMax)`.** You cannot own fewer of something
than you have packed at once, so evidence raises a claim and never the reverse.
This is what makes a default of 1 safe: accept the 1 on "Socks", tick
"Socks × 6" off a list, and the row reads 6 rather than holding a stale number.
Storage still says 1 — the max is computed on read, so nothing is rewritten
behind the user's back.

**`KitItem.qty` is optional, and the two cases are not the same claim:**

- Added through the **inventory form** → a real `1`. They saw that number and
  let it stand, so it counts and it may warn.
- Added as a **side effect of packing** (`addItem`, "if you packed it, you own
  it") → left undefined. Nobody was shown a quantity to accept. Don't "fix"
  this to 1; it would turn a side effect into a claim and warn on rows the
  person never counted.

Two more things depend on the distinction:

- `setKitQty` **creates** the `KitItem` when a label only exists as a derived
  row. Nudging a stepper is the whole "this is mine" flow; there is no separate
  claim step.
- `shortfall()` ignores `assumed` numbers. Everything uncounted sits at 1, so
  without that guard a new person's first trip would warn on every row that
  asks for more than one. Only `counted` and `inferred` may speak.

The inventory stepper's `min` is `packedMax`, so it can't be set below the
floor — `resolveQty` would only put it back, which reads as a bug.

`AddKitForm`'s **How many** field sets the count for the whole submission, as
the category does, and resets to 1 after each add — the category persists
because people file several things into one place in a row, but a 2 carried
into the next add would quietly claim two of whatever comes next.

`parseEntries` still understands a trailing `x3` and a line that names its own
count overrides the field. It isn't advertised anywhere; it stays because
pasting a list that already carries counts is a real thing to do, and the
alternative is an item named "Wool socks x2".

Listing something already in the inventory **adds up** rather than erroring. With
**How many** at 1 that means one more than the row shows; above 1 it's taken as
the count. The old "already in your inventory" error was the wrong answer to a
reasonable request (see the Assignment 3 feedback: owning two t-shirts was
unsayable).

**Categories are open.** `ItemCategory` is a plain `string`; `KNOWN_CATEGORIES`
holds the seven defaults and `categoriesPresent()` orders known-then-custom. Use
`styleFor(category)` from `components/categoryStyle.ts` rather than indexing the
map, so an invented category still gets a colour.

## Pictures

`src/lib/photos.ts` holds one Wikimedia CDN thumbnail per destination slug. Those
URLs were resolved once by hand from Wikipedia's page-summary endpoint and each
verified to return 200; **the running app never calls an API**. Requesting widths
above the stored thumbnail returns 400, so don't rewrite the `NNNpx-` segment.

`DestinationArt` falls back to a generated SVG poster when there's no photo for a
destination, or when the image fails to load. The poster is drawn *from the
climate data* — sun height, palette and rain density all come from the month's
conditions — so an unknown destination still gets a picture that means something.

## Data model

Three tables. Two hold one person's data and are fenced by row-level security;
one is shared reference data nobody owns. Read this before writing a migration.

**Clerk user ids are strings, not UUIDs** (`user_2abc...`), so `user_id` is `text`.
This is the single most likely thing to get wrong: with Supabase third-party auth,
`auth.uid()` expects a Supabase UUID and will **not** work here. Every policy
compares against the JWT's subject claim instead:

```sql
(auth.jwt() ->> 'sub') = user_id
```

### trips

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` pk, `gen_random_uuid()` | replaces `crypto.randomUUID()` |
| `user_id` | `text not null` | Clerk `sub` |
| `name` | `text not null` | "Thanksgiving at my parents'" |
| `destination` | `text not null` | free text, shown on the board |
| `climate_slug` | `text` | set when the destination matched the table |
| `manual_band` / `manual_wetness` | `text` | set when it didn't |
| `start_date` / `end_date` | `date not null` | were `"YYYY-MM-DD"` strings |
| `items` | `jsonb not null default '[]'` | the checklist — see below |
| `learned` | `jsonb not null default '{"drop":[],"add":[]}'` | corrections carried forward |
| `review` | `jsonb` | `neverUsed`, `wishedFor`, `reviewedAt` |
| `is_example` | `boolean not null default false` | the worked example |
| `completed_at` | `timestamptz` | set when the trip is finished |
| `created_at` | `timestamptz not null default now()` | |

**Items stay as `jsonb` rather than becoming a fourth table.** The checklist is
always read and written whole: no query filters, sorts or joins on a single item,
and the inventory already aggregates them in JS (`buildInventory`). One row per
trip also means one RLS check per trip instead of per item. The costs, accepted
knowingly: no per-item access control (items are only ever reached through their
trip, so there's nothing to protect separately), and no SQL aggregation across
items. If a query ever needs to ask "which trips contain a sun hat", revisit this.

### kit_items

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` pk, `gen_random_uuid()` | |
| `user_id` | `text not null` | Clerk `sub` |
| `label` | `text not null` | |
| `category` | `text not null` | open-ended; see **Categories are open** |
| `qty` | `integer` | **nullable on purpose** |
| `added_at` | `timestamptz not null default now()` | |

Add `unique (user_id, lower(label))`. `buildInventory` keys rows by lowercased
label and assumes one row per label; Assignment 3 enforced that only in app code,
and a constraint makes it real.

`qty` being nullable is load-bearing, not laziness — null means nobody ever said
how many, which the inventory treats differently from a number someone chose. See
the quantity rules above; **do not add `default 1`.**

### climate_cache

Shared, derived, owned by nobody. Keyed by coordinates rounded to 0.1° and the
month, holding the averaged normals plus how many years went into them and when
it was fetched. No `user_id`.

It exists because the free weather tier rate-limits per IP, and because normals
for March in Lisbon are identical for every user on the planet — so one fetch
should serve everybody. That is also the answer to "where do you call the API and
why there": on the server, because the result is shared and caching it is the
whole point.

Measured, not assumed: a cold lookup is 15 sequential Open-Meteo requests at
about 5.3s; the same lookup served from this table takes 741ms. Open-Meteo
returned 429 after roughly ten calls from one shared IP, and their terms warn
that platforms like Vercel are throttled early, so without the cache the second
visitor to look up a city would be refused.

### Row-level security

Enable RLS on all three. For `trips` and `kit_items`, write all four policies —
select, insert, update, delete — each `using ((auth.jwt() ->> 'sub') = user_id)`,
and **insert and update also need `with check` on the same expression**. Without
`with check`, `using` alone lets someone write a row stamped with another
person's `user_id`. That omission is exactly what `/security-review` should catch,
so don't make it by accident.

`climate_cache` is the deliberate contrast: readable by any authenticated user,
writable by none. Only the server, holding the service role, fills it — see
`lib/supabase-admin.ts`, which is the single place that key is used and carries
`import "server-only"` so a client import fails the build rather than shipping
it. Two tables fenced per-user and one shared read-only table is a much easier
thing to explain than three identical policies.

**This was briefly built the other way, and `/security-review` caught it.** The
first version let any signed-in user insert, on the reasoning that a
service-role key in the environment was the worse risk. It wasn't: a check
constraint bounding the values didn't help, because a plausible-but-wrong row
(Lisbon in March at −20 °C, with an attacker-chosen label) still passed, and
with no update or delete policy it would have stayed. Writes are now refused by
an explicit `with check (false)` rather than a missing policy, so the refusal is
visible to anyone reading `pg_policies` instead of looking like an oversight.

### What the port broke

Assignment 3's state layer did not survive. These needed designing rather than
translating, and all four are **done** — recorded because the reasoning is
easier to lose than the code:

- **`HAS_TRIPS_SCRIPT` and `data-has-trips` died.** Replaced by the three-state
  gate described under *Stack notes*. The client cannot know which of signed
  out / signed in empty / signed in with trips applies before paint, so it
  admits that rather than guessing.
- **`readState` / `writeState` are gone** with `STORAGE_KEY` and
  `LEGACY_STORAGE_KEY`. Writes are optimistic — a round trip per checkbox tick
  would make packing feel broken — and a refused write sets `error` and
  refetches so the screen converges on the database rather than drifting.
- **Ids stay client-generated**, which is the one place the plan changed: it
  keeps `addTrip` synchronous for callers and lets an optimistic row carry its
  final id instead of swapping a placeholder when the insert returns.
- **Seeding the worked example** (`is_example`) is the one piece **still
  outstanding**. It used to be built on first paint from `lib/example.ts`; with
  accounts it belongs at first sign-in, server-side. Until then a brand-new
  account sees the starter trips but not the worked example, so the correction
  loop goes unillustrated — which was the whole reason that component exists.

## Hard constraints

These come from the assignment brief. Do not violate them, and push back if asked to.

**Assignment 4 reversed the first two constraints of Assignment 3.** The old rules
said no external APIs, no database and no accounts; the brief now requires all
three. The notes below are the current rules. Where this file still describes
`localStorage` as "the entire backend", that is Assignment 3's architecture,
which is being replaced — see **Data model** above.

- **Accounts are required.** Clerk, on **development keys only**; production keys
  need a domain we don't own. A signed-out visitor must reach nobody's data.
- **Data lives in Supabase**, with row-level security on every table.
- **Exactly one external API** does real work. More than one and none of them is
  load-bearing, which muddies the "where do you call it, and why there" answer
  the assignment grades. Nothing API-related is built until auth and the database
  are standing — it's step 6 for a reason.
- **Keys go in `.env.local`, never in the code or a commit.** `.claude/settings.json`
  denies `Read(./.env)` and `Read(./.env.*)`, so an agent cannot read them and must
  not try. Do not add `Bash(cat:*)`, `head`, `tail`, `grep` or `python3` to the
  allow list: those read `.env.local` straight past the deny rule.
- **No new packages** beyond what Clerk, Supabase and Playwright require, without
  asking first. Still no state library, no form library, no date library, no UI
  kit, no icon package.
- Deployed on Vercel's free Hobby plan. Work on a branch; `main` holds the
  Assignment 3 submission until the work is reviewed and merged.
- `AGENTS.md` (this file) is the context file. There must be no `CLAUDE.md`.

**Keep the walkthrough's status panel current.** `../assignment-4-walkthrough.html`
(one level up, outside the repo) carries a **Where this stands** panel: one row
per assignment step, with what is actually built. Update it when a step changes
state — finished, started, or found to be wrong — and not otherwise. A commit is
not a milestone; "sign-in works and signed-out is locked out" is. Roughly one
edit per step, eight or so for the whole assignment. Don't narrate progress into
it, and don't touch the checkboxes below it: those are the user's, stored in
their browser, and overwriting them isn't possible from here anyway.

## Stack notes that actually bite

Next.js 16.4.2, React 19.3, Tailwind v4. Three things differ from older training data:

1. **`cacheComponents: true`** is on in `next.config.ts`. Next uses React
   `<Activity>` to keep recently visited routes *mounted* (hidden) across client-side
   navigation. Per-route component state is therefore preserved, not torn down.
   **Consequence:** never let two routes each hold their own copy of the trips state —
   one will go stale. All trip state lives in a single provider in the root layout
   (`src/app/providers.tsx`), and every route reads it through the `useTrips()` hook.

2. **Tailwind v4 has no `tailwind.config.js`.** Design tokens are declared in
   `src/app/globals.css` with `@theme`. Add a color there and it becomes a utility
   (`--color-accent` → `bg-accent`, `text-accent`).

3. **The first-visit gate has three states, not two.** A returning person must
   never see the first-visit screen flicker past. Assignment 3 solved that with an
   inline `<head>` script reading `localStorage` before first paint; that script
   and `lib/storage.ts` are both **gone**, because the answer now comes from
   Supabase over the network and cannot be known before paint — and because with
   accounts there are three cases: signed out, signed in with nothing, signed in
   with trips.

   `<html>` therefore ships `data-has-trips="loading"`, which `globals.css` uses to
   hide *both* faces, and `TripsProvider` rewrites it to `yes`/`no` once the fetch
   resolves. A frame of nothing beats a frame of the wrong screen. If you add a
   fourth state, the CSS gate and that effect must change together.

4. **Hand-written CSS must go in `@layer base`.** Tailwind v4 emits utilities
   inside a cascade layer, and unlayered rules beat layered ones regardless of
   specificity. A bare `a { text-decoration: underline }` in `globals.css`
   therefore won against `no-underline` on *every* link, underlining the text
   inside every button-styled link. Element defaults belong in `@layer base`;
   only classes that must win (`.checkbox`, the `[data-when]` gate) stay
   unlayered.

5. **Tailwind arbitrary values can't hold an inline SVG data URI.** The checkbox
   tick was written as `bg-[url('data:image/svg+xml;utf8,<svg …>')]` and silently
   compiled to `background-image: none` — the angle brackets, hash and spaces
   don't survive. It lives in `globals.css` as `.checkbox:checked` instead. Note
   also that editing `globals.css` reliably needs a dev-server restart before
   Turbopack serves the change — budget for it rather than debugging a ghost.

Generated route types are real: use `LayoutProps<"/">` and `PageProps<"/trips/[id]">`
rather than hand-writing props.

## Design system — Café Terrace

Carried over from Assignment 2 (https://design-hw2.vercel.app/design-systems/a).
The mood: *parchment and pressed ink under a red awning. Printed, unhurried, worn at
the corners.* It should read like a typeset document, not a web app — which suits a
a departure board and a packing manifest.

Colors, declared as tokens in `globals.css`:

| Token | Hex | Use |
|---|---|---|
| `background` | `#E8DCC5` | the page |
| `surface` | `#F6EFE3` | cards, inputs, panels |
| `surface-raised` | `#EAE2D7` | hover fill on quiet controls |
| `selected` | `#EDD8CC` | chosen rows and chips |
| `ink` | `#2B1D16` | headings and body |
| `muted` | `#685C54` | captions, meta, placeholders |
| `rule` | `#C3BAB0` | dividers and plate rules |
| `rule-strong` | `#83796F` | input and control edges (darkened from `#90867C` to clear 3:1 against the page) |
| `accent` | `#AE3220` | primary action only |
| `success` | `#41662F` | confirmation |
| `error` | `#7B1E2B` | failure and destructive |
| `warning` | `#7A4F10` | caution |

Type: **Fraunces** for display and headings, **Source Sans 3** for body and labels.
Display 56/52 w600 `-0.02em`; Heading 28/34 w600; Body 16/26 w400 (max 68 characters
per line); Label 11/16 w600 uppercase `0.14em`.

Shape and rules — these are what make it look printed, so hold the line:
- **Border radius is 0.** Controls may use 2px. Nothing rounder is permitted.
- Shadows are hard-offset with **no blur** (`none`, `raised`, `lifted`).
- 1px hairline dividers, 1px strong on control edges, 2px section rules, 3px accent
  rule on a selected tab.
- Focus outline 2px, offset 2px — tomato on quiet controls, espresso on accent fill.
- Spacing is a 4px scale: 4, 8, 12, 16, 24, 32, 48, 64.

**Category colours** live in `src/components/categoryStyle.ts` — one muted pigment
per packing category (slate, rust, olive, leather, pine, graphite, ochre). They're
there so a 24-item list can be scanned by section. None of them come near the
accent, which still belongs to the primary action alone.

Component rules: primary button is the only accent fill and shifts down 1px when
pressed; secondary never uses accent; links are always underlined. Checkbox is
square, radio is round. Badges are status only, never clickable. An error is a rule,
an icon and a tint — **never an accent-coloured button**.

## Requirements this app is graded on

Assignment 4 adds these, and they are the ones that decide the grade:

- **Accounts:** sign up, sign in, sign out with Clerk. A signed-out visitor sees
  nobody's data — check it signed out, don't assume it.
- **Data in Supabase**, row-level security on every table, each person seeing only
  their own rows.
- **One external API**, with designed states for loading, nothing found, and the
  API being down.
- **Persistence:** what you save is still there after signing out and back in, on
  another device. This is the requirement that makes accounts worth having here —
  pack on a laptop over several evenings, tick items off on a phone at the suitcase.
- **Keys** in environment variables, never in the code or the repository, with a
  deny rule for `.env` files.
- **One Playwright test** proving two users can't see each other's data, *watched
  failing* before it passes. Break RLS on purpose to see it fail.
- **`/security-review`** run on the branch, findings handled.
- **Deployed on Vercel**, where a classmate can make an account and use it.
- A commit history that shows progress. A one-shot submission is marked incomplete.

Assignment 3's requirements still hold — the UI/UX work is not superseded:

- A page per flow step with shared navigation, and it's clear where you are.
- First visit gives something useful immediately; no dead-end empty screen.
- Forms: one column, a real `<label>` on every field, errors rendered **next to the
  field** and phrased as an instruction ("Enter a destination." not "Invalid input."),
  and **every value the person typed survives a failed submit**.
- Coming back: the app remembers, and the returning experience is designed, not
  incidental.
- Shared components used consistently — `Button`, `Field` (with `TextInput`,
  `Select`, `TextArea`, `Checkbox`), `Card`, and `Controls` (`Stepper`,
  `QuietAction`, `SegmentedControl`, `Chip`, `SuggestionList`). **Don't style a
  one-off control inline.** The check is a grep: `<button`, `<input`,
  `<textarea>` and `<select` should appear nowhere outside those three files.
- Accessibility: full keyboard operation, visible focus, real labels, errors
  associated with their field (`aria-describedby` + `role="alert"`), and text
  contrast checked.
- Simplicity: prefer removing a step, a field, or an interaction.

## Conventions

- `src/lib/` is pure logic with no React: `climate.ts`, `suggestions.ts`,
  `trips.ts`, `inventory.ts`, `open-meteo.ts`, `trips-db.ts`. Keep it testable by
  reading. (`storage.ts` is gone — localStorage was Assignment 3's backend.)
- Three Supabase clients, and the distinction is the access-control story:
  `lib/supabase.ts` (browser, caller's Clerk token), `lib/supabase-server.ts`
  (route handlers, also the caller's token), and `lib/supabase-admin.ts` (service
  role, `import "server-only"`, used for exactly one insert into `climate_cache`).
  Never reach for the third for anything with a `user_id`.
- `src/components/` is the shared component set.
- Dates are stored as `YYYY-MM-DD` strings, never `Date` objects, so a row reads
  plainly in the table editor and is timezone-stable.
- IDs come from `crypto.randomUUID()` in the client, not the column default, so
  an optimistic row carries its final id immediately.
- Commit in small steps — the commit history is graded.
