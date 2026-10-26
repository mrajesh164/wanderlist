import { defineConfig, devices } from "@playwright/test";

/**
 * One test, run against a real dev server with real Clerk sessions and a real
 * Supabase database. Nothing is mocked: the point of this test is to prove that
 * row-level security actually fences two accounts apart, and a mock would only
 * prove that the mock does.
 *
 * `fullyParallel` is off and there is one worker. The two users in the test
 * write to the same tables, and a parallel run would make a failure ambiguous
 * between "RLS is broken" and "the tests raced each other" — which is precisely
 * the ambiguity this test exists to remove.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  /* No retries. A flaky pass would be worse than a failure here: this test is
     the evidence that one account cannot read another's rows, and "it passed
     on the third attempt" is not evidence. */
  retries: 0,
  reporter: [["list"]],
  /* Generous: a cold climate lookup is 15 sequential Open-Meteo requests, and
     signing two users in takes a few seconds each. */
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /* Reuses a dev server if one is already running, so this doesn't fight the
     terminal tab during development. */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
