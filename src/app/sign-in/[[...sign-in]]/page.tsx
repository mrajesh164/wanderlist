import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

/**
 * The `<Suspense>` boundary is not optional here.
 *
 * `cacheComponents` is on (see next.config.ts), and Clerk's catch-all component
 * reads the URL with `usePathname()` to decide which step of the flow to show.
 * Next refuses to prerender a client hook that needs runtime data unless it sits
 * inside a boundary, so without this `next build` fails outright with
 * `CLIENT_HOOK_DYNAMIC`. The Clerk CLI scaffolds these pages without it.
 *
 * The fallback is the same quiet placeholder the trip and inventory pages use
 * while they wait, rather than a spinner — it reserves the height so the form
 * doesn't shove the page around when it streams in.
 */
export default function SignInPage() {
  return (
    <div className="flex justify-center py-8">
      <Suspense fallback={<div aria-hidden="true" className="h-96" />}>
        <SignIn />
      </Suspense>
    </div>
  );
}
