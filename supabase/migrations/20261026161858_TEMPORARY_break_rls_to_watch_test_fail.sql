-- DELIBERATELY BROKEN. Reverted by the next migration.
--
-- Assignment step 7: "Break your row-level security on purpose and watch the
-- test fail, then fix it and watch it pass."
--
-- This loosens the select policy on `trips` so every signed-in user can read
-- every row. Both migrations are kept rather than squashed, because the pair is
-- the evidence: a test that has only ever passed proves nothing about whether
-- it would catch the thing it claims to catch.
--
-- With this applied, e2e/isolation.spec.ts failed at exactly the intended line:
--
--   Error: expect(locator).toHaveCount(expected) failed
--   Locator:  getByText('A-only-1793031545447')
--   Expected: 0
--   Received: 1
--
-- User B's board rendered User A's trip. No application code changed between
-- the passing and failing runs — only this policy.

alter policy "Select own trips"
  on public.trips
  using (true);
