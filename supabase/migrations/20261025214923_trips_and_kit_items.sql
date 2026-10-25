-- Wanderlist: the two tables that hold one person's data.
--
-- climate_cache is deliberately NOT here. It belongs to step 6 and nothing
-- API-related gets built until auth and the database are standing. See the
-- Data model section of AGENTS.md.
--
-- user_id is text, not uuid. Clerk subjects are strings ("user_2abc..."), so
-- auth.uid() -- which expects a Supabase uuid -- will not work. Every policy
-- below compares against the JWT's subject claim instead. This is the single
-- most likely thing to get wrong, and it fails quietly: the policies match
-- nothing and the app looks empty rather than broken.

-- ---------------------------------------------------------------- trips ----

create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  name          text not null,
  destination   text not null,

  -- Set when the destination matched the climate table; the manual_* pair is
  -- set when it didn't and the person picked conditions themselves.
  climate_slug   text,
  manual_band    text,
  manual_wetness text,

  start_date    date not null,
  end_date      date not null,

  -- The checklist, held whole rather than as a child table: it is always read
  -- and written in one piece, nothing queries an individual item, and the
  -- inventory aggregates in JS. One row per trip also means one RLS check per
  -- trip instead of one per item.
  items         jsonb not null default '[]'::jsonb,

  -- Corrections carried forward from past runs of this trip: {drop:[], add:[]}
  learned       jsonb not null default '{"drop": [], "add": []}'::jsonb,

  -- {neverUsed:[], wishedFor:[], reviewedAt} once the trip has been reviewed
  review        jsonb,

  is_example    boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),

  -- The form already refuses a trip that ends before it starts. Saying it here
  -- too means a bad row cannot arrive by any other route.
  constraint trips_dates_ordered check (end_date >= start_date)
);

-- Every query is "my trips", so this index carries essentially all of them.
create index trips_user_id_idx on public.trips (user_id);

alter table public.trips enable row level security;

create policy "Select own trips"
  on public.trips for select
  using ((auth.jwt() ->> 'sub') = user_id);

-- with check, not using: insert has no existing row to test, so this is what
-- stops a row being written stamped with somebody else's user_id.
create policy "Insert own trips"
  on public.trips for insert
  with check ((auth.jwt() ->> 'sub') = user_id);

-- update needs both. `using` decides which rows you may change; `with check`
-- decides what they may become. Without the second, you could reassign your
-- own trip to another user_id.
create policy "Update own trips"
  on public.trips for update
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Delete own trips"
  on public.trips for delete
  using ((auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------- kit_items ----

create table public.kit_items (
  id        uuid primary key default gen_random_uuid(),
  user_id   text not null,
  label     text not null,

  -- Open-ended on purpose: the seven defaults cover most packing, but someone
  -- who needs "Climbing gear" shouldn't have to file it under Extras.
  category  text not null,

  -- Nullable ON PURPOSE, and there must be no default. NULL means nobody ever
  -- said how many, which the inventory treats differently from a number
  -- somebody chose: it infers a floor from what has actually been packed
  -- instead. A `default 1` would turn every side-effect row into a claim and
  -- make the shortfall warnings fire on counts no one set.
  qty       integer,

  added_at  timestamptz not null default now(),

  constraint kit_items_qty_range check (qty is null or (qty >= 1 and qty <= 99))
);

create index kit_items_user_id_idx on public.kit_items (user_id);

-- buildInventory keys rows by lowercased label and assumes one row per label.
-- Assignment 3 enforced that in app code only; this makes it real.
create unique index kit_items_user_label_idx
  on public.kit_items (user_id, lower(label));

alter table public.kit_items enable row level security;

create policy "Select own kit items"
  on public.kit_items for select
  using ((auth.jwt() ->> 'sub') = user_id);

create policy "Insert own kit items"
  on public.kit_items for insert
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Update own kit items"
  on public.kit_items for update
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Delete own kit items"
  on public.kit_items for delete
  using ((auth.jwt() ->> 'sub') = user_id);
