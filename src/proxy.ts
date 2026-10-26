import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";

/**
 * Everything is protected except the three routes below.
 *
 * `clerk init` scaffolds a bare `clerkMiddleware()`, which establishes auth
 * context and protects nothing — its own output says "routes are public by
 * default". So a signed-out visitor could reach every trip and the whole
 * inventory. Allow-listing the public routes rather than enumerating the
 * private ones means a route added later is protected by default, which is the
 * safer direction to be wrong in.
 *
 * `/` stays public deliberately. Bouncing a signed-out visitor straight to a
 * sign-in wall is the dead-end empty screen Assignment 3 was explicitly about
 * avoiding — a classmate opening the link should learn what this is before
 * being asked for an account. It shows nothing personal: no trips, no
 * inventory, no names. "Signed out sees nobody's data" is about data, not about
 * refusing to say what the app does.
 */
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

/**
 * Refuse a dev-browser token that arrives in the URL. This closes the one
 * finding from the second `/security-review` pass, and it is worth explaining
 * because the vulnerability is in a mandated constraint rather than in a line
 * of this app's code.
 *
 * On a Clerk instance of type `development` — which the brief requires, since
 * production keys need a domain we don't own — the token that identifies a
 * Clerk *client* is accepted from the query string, not only from a cookie.
 * `@clerk/backend` reads the query parameter *first*
 * (`initHandshakeValues`: `getQueryParam(DevBrowser) || getCookie(DevBrowser)`),
 * and the only gate on the handshake branch is `searchParams.has(...)` — no
 * signature check, no origin check. The middleware then forwards that token to
 * Clerk's handshake endpoint, writes back whatever session cookies come out,
 * and scrubs the parameter from the URL.
 *
 * So: an attacker signs up, copies their own `__clerk_db_jwt` out of their own
 * cookie jar, and sends anybody a link ending `?__clerk_db_jwt=<theirs>`. The
 * visitor's browser is handshaked onto the attacker's client and the app
 * renders as signed in, with nothing in the URL and nothing but an avatar
 * popover to say whose account it is. Every trip they then save is stamped
 * with the attacker's Clerk id and is theirs to read. **Row-level security is
 * no defence**: the policies are enforcing an identity that is simply the
 * wrong one, which is the useful lesson — a fence below the auth layer cannot
 * save you from a lie told above it.
 *
 * Stripping the parameter is safe *here* specifically because sign-in is
 * embedded (`<SignIn />` at `/sign-in`), same-origin. The legitimate user of
 * this parameter is Clerk's cross-origin dev sync, which carries the token
 * back from a hosted Account Portal on `*.accounts.dev`; this app never
 * redirects there, so nothing of ours needs it. An app using the hosted pages
 * could not do this without breaking its own sign-in.
 *
 * What this does not do is make a development instance safe. The attacker can
 * still reach for the handshake *nonce* with more work, and that path can't be
 * stripped — the real handshake return needs it. Only production keys close
 * the class. This removes the cheap, reusable, copy-one-cookie version of it.
 */
const DEV_BROWSER_PARAM = "__clerk_db_jwt";

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const url = new URL(req.url);
  /* Suffixed too (`__clerk_db_jwt_xyz`), because Clerk suffixes its cookie
     names per instance and an attacker gets to pick the parameter. */
  const injected = [...url.searchParams.keys()].filter((key) =>
    key.startsWith(DEV_BROWSER_PARAM),
  );

  if (injected.length > 0) {
    for (const key of injected) url.searchParams.delete(key);
    /* Redirect rather than rewrite, so the token doesn't survive in the
       address bar to be pasted on or shared again. There's no loop: the
       parameter is gone from the location we send them to. */
    return NextResponse.redirect(url, 307);
  }

  return withClerk(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
