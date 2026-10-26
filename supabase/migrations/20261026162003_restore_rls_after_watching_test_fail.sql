-- Reverts the deliberate break in the previous migration.
--
-- After this, e2e/isolation.spec.ts passes again (12.0s, 1 passed). The
-- application code was byte-identical across both runs — the only difference
-- was this policy, which is the whole argument: row-level security is what
-- fences the two accounts apart, not anything in the UI.
--
-- Verified from pg_policies afterwards rather than assumed:
--   Select own trips | SELECT | ((auth.jwt() ->> 'sub'::text) = user_id)

alter policy "Select own trips"
  on public.trips
  using ((auth.jwt() ->> 'sub') = user_id);
