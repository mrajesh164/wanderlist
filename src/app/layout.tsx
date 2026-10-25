import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { TripsProvider } from "./providers";
import { Nav } from "@/components/Nav";
import { ResetFirstVisit } from "@/components/ResetFirstVisit";
import { HAS_TRIPS_SCRIPT } from "@/lib/storage";

/* Café Terrace: Fraunces for display and headings, Source Sans for everything else. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wanderlist",
  description:
    "Packing lists for your favorite destinations. Built from your dates, the weather there that month, and what you learned last time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* suppressHydrationWarning because the inline script below sets
       data-has-trips before React hydrates — the DOM is intentionally ahead of
       the server's output here, and React should accept it. */
    <html
      lang="en"
      data-has-trips="no"
      /* globals.css sets scroll-behavior: smooth for in-page step links. This
         tells Next that's deliberate, so it stops warning and stops applying it
         to route changes — gliding between anchors is nice, gliding on every
         navigation is not. */
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <head>
        {/* Runs synchronously during HTML parsing, so a returning person never
            sees the first-visit screen flash past before hydration. Paired with
            the lazy read in TripsProvider, which uses the same storage key. */}
        <script dangerouslySetInnerHTML={{ __html: HAS_TRIPS_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-ink">
        <ClerkProvider>
          <TripsProvider>
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
              {children}
            </main>
            <footer className="mx-auto w-full max-w-5xl px-5 pb-8">
              <div className="border-t border-rule pt-3">
                <ResetFirstVisit />
              </div>
            </footer>
          </TripsProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
