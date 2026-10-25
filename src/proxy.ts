import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
