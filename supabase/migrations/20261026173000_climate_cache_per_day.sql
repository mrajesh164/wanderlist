-- Per-day normals alongside the monthly ones.
--
-- The archive already answers with a value per day per year; collapsing
-- straight to a monthly mean discarded that. Keeping it costs no extra API
-- calls and lets a trip show its own dates rather than a sentence about the
-- month.
--
-- Shaped as [{ day, highC, lowC, wetChance }, ...] — one entry per day of the
-- month, ascending, with days the month doesn't have simply absent.
--
-- jsonb rather than a child table for the same reason trips.items is jsonb:
-- it's always read and written whole, nothing queries an individual day, and
-- one row per place-month keeps the cache key simple.
--
-- Nullable with no default, so rows cached before this migration stay valid
-- and are treated as "monthly only". The route refetches them when a caller
-- needs per-day detail rather than guessing, because a row written last week
-- genuinely has no per-day data to infer.

alter table public.climate_cache
  add column days jsonb;
