-- Shared, derived, owned by nobody: what a month is typically like at a place.
--
-- This table is the answer to "where do you call the API, and why there". The
-- normals for March in Lisbon are identical for every user on the planet, so
-- one fetch should serve everybody. It is not an optimisation: Open-Meteo's
-- free tier returned 429 after about ten calls from a shared campus IP, and
-- its own terms warn that Vercel's shared addresses get throttled early.

create table public.climate_cache (
  -- Coordinates rounded to 0.1 degree (~11km) and joined, e.g. "38.7,-9.1".
  -- Rounding is what makes the cache hit: two people typing "Lisbon" get
  -- slightly different geocoder results but the same key.
  place_key    text not null,
  month        smallint not null,

  high_c       numeric(4,1) not null,
  low_c        numeric(4,1) not null,
  rain_days    numeric(4,1) not null,

  -- How many years were averaged. Shown as provenance, and lets a thin early
  -- sample be refreshed later without guessing why it looked wrong.
  sample_years integer not null,

  -- "Lisbon, Portugal" — for display, so a cache hit needs no second geocode.
  label        text,

  fetched_at   timestamptz not null default now(),

  primary key (place_key, month),
  constraint climate_cache_month_valid check (month between 1 and 12),
  constraint climate_cache_sample_sane check (sample_years between 1 and 60)
);

alter table public.climate_cache enable row level security;

-- Readable by anyone signed in. There is nothing personal here.
create policy "Signed-in users may read climate"
  on public.climate_cache for select
  to authenticated
  using (true);

-- Writable by anyone signed in, deliberately, and this is a trade-off worth
-- being able to defend. The purist version is "only the server, holding the
-- service role, may write" -- but that means putting a key that bypasses
-- every RLS policy in the environment, which is a far bigger risk than a
-- signed-in user being able to append derived weather numbers. No update and
-- no delete policy, so a cached row cannot be altered or removed once written.
create policy "Signed-in users may fill the cache"
  on public.climate_cache for insert
  to authenticated
  with check (true);
