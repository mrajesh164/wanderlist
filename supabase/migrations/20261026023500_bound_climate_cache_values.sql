-- Bound what a cached climate row may contain.
--
-- From /security-review on the full-stack branch. climate_cache is the one
-- table any signed-in user may write to (see the trade-off argued in the
-- original migration: the alternative puts a service-role key, which bypasses
-- every RLS policy, into the environment). That write stays open, but it can no
-- longer say anything it likes.
--
-- Without this, numeric(4,1) permitted +/-999.9 for all three figures and
-- `label` was unbounded text.
--
-- PARTIAL MITIGATION, and the limit matters. Tested after applying: an insert
-- of (38.7,-9.1), March, high -20C / low -25C / 30 wet days, with a
-- phishing-style label, was still ACCEPTED -- because those are plausible
-- numbers for *somewhere*, just not for Lisbon. This constraint stops absurd
-- values and over-long labels; it cannot stop plausible-but-wrong ones, which
-- is the exploit the review actually described.
--
-- What would close it: a `security definer` function that performs the
-- Open-Meteo fetch itself, so the values are never caller-supplied at all, and
-- dropping the public insert policy. That satisfies the documented design in
-- AGENTS.md ("writable by none") without a service key in the environment.
--
-- The ranges are generous enough to never reject real weather: the records are
-- about -89C and +57C, and a month cannot have more than 31 wet days.

alter table public.climate_cache
  add constraint climate_cache_values_plausible check (
    high_c between -60 and 60
    and low_c between -70 and 50
    and low_c <= high_c
    and rain_days between 0 and 31
    and (label is null or length(label) <= 80)
  );
