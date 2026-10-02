import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { dwtsLink } from "@/lib/links";

export const metadata: Metadata = {
  title: "Page not found · Armchair Judge",
};

const PADDLES = [
  { v: "4", face: "bg-text text-night" },
  { v: "0", face: "bg-linear-to-br from-blue via-magenta to-orange text-text" },
  { v: "4", face: "bg-text text-night" },
];

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_20%,rgb(122_44_255/0.2),transparent)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center sm:py-28">
          <div className="flex items-end gap-3 overflow-hidden px-4 pt-6 sm:gap-5" aria-hidden="true">
            {PADDLES.map((p, i) => (
              <div key={i} className="lost-paddle flex flex-col items-center" style={{ "--delay": `${150 + i * 160}ms` } as CSSProperties}>
                <span
                  className={`flex h-20 w-16 items-center justify-center rounded-2xl text-4xl font-extrabold tabular-nums shadow-xl shadow-violet/20 sm:h-24 sm:w-20 sm:text-5xl ${p.face}`}
                >
                  {p.v}
                </span>
                <span className="h-10 w-2 rounded-b-sm bg-muted/50" />
              </div>
            ))}
          </div>
          <div className="h-2 w-64 max-w-full rounded-full bg-linear-to-r from-blue via-magenta to-orange opacity-80" aria-hidden="true" />

          <p className="mt-10 text-xs font-semibold tracking-[0.3em] text-gold uppercase">Error 404</p>
          <h1 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            The panel can&rsquo;t <span className="text-brand-gradient">score this page.</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            It isn&rsquo;t on tonight&rsquo;s running order. The link may have a typo, or the page has moved.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center rounded-full bg-text px-6 font-semibold text-night shadow-lg shadow-violet/20 transition-colors hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold active:scale-[0.98] motion-reduce:transition-none"
            >
              Back to the hub
            </Link>
            <a
              href={dwtsLink()}
              className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-semibold text-text transition-colors hover:border-muted hover:bg-night-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold active:scale-[0.98] motion-reduce:transition-none"
            >
              Judge Dancing with the Stars
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
