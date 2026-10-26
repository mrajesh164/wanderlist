-- Close the climate_cache finding from /security-review properly.
--
-- The original policy let any signed-in user insert arbitrary rows into a table
-- every other user reads, with no update or delete policy to undo them. The
-- check constraint added just before this bounded absurd values but not
-- plausible-but-wrong ones -- tested, and a Lisbon-in-March row at -20C with a
-- phishing-style label was still accepted. Bounding the data was the wrong
-- lever; the fix is that clients cannot write this table at all.
--
-- Writes now come from the server holding a service-role key, which is what
-- AGENTS.md specified from the start ("writable by none. Only the server,
-- holding the service role, fills it"). The earlier argument for keeping the
-- insert open -- that a service key in the environment is worse than an open
-- write -- does not hold up: the key is server-only, never prefixed
-- NEXT_PUBLIC_, guarded by `import "server-only"` so a client import is a build
-- error, and kept out of the repo by .gitignore and the agent deny rule. That
-- is a smaller risk than every account holder being able to change what every
-- other account holder is told to pack.
--
-- The policy is altered to `with check (false)` rather than dropped, so the
-- intent stays visible in `pg_policies`: a reviewer reading the live database
-- sees an explicit refusal rather than an absence, and cannot mistake it for a
-- policy somebody forgot to write. The service role bypasses RLS, so this does
-- not block the server.
--
-- The select policy is untouched: any signed-in user may still read the cache.
-- The check constraint stays too, as defence in depth against a server bug.
--
-- Verified after applying, acting as an ordinary authenticated user:
--   insert  -> ERROR 42501: new row violates row-level security policy
--   select  -> succeeds

alter policy "Signed-in users may fill the cache"
  on public.climate_cache
  with check (false);
