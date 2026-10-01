import Link from "next/link";

import { AppsMenu } from "@/components/apps-menu";
import { ChairMark } from "@/components/chair-mark";
import { DWTS_URL } from "@/lib/links";

const link =
  "flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-gold motion-reduce:transition-none";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/60">
      <a
        href="#main"
        className="sr-only rounded-full bg-gold px-5 text-sm font-semibold text-night focus:not-sr-only focus:absolute focus:top-2.5 focus:left-3 focus:flex focus:min-h-11 focus:items-center focus:z-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        Skip to content
      </a>
      {/* The blur sits on its own layer: backdrop-filter on the header itself would
          make it the containing block for the apps menu's fixed mobile sheet. */}
      <div className="absolute inset-0 -z-10 bg-night/80 backdrop-blur-md" aria-hidden="true" />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-gold">
          <ChairMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 motion-reduce:transition-none" />
          <span className="text-base font-bold tracking-tight">
            Armchair <span className="text-brand-gradient">Judge</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/#how" className={`${link} hidden md:flex`}>
            How it works
          </Link>
          <Link href="/#shows" className={`${link} hidden md:flex`}>
            Shows
          </Link>
          <AppsMenu />
          {/* DWTS's signed-out landing is where Google sign-in starts, until the hub has its own. */}
          <a
            href={DWTS_URL}
            className="ml-1 hidden min-h-11 items-center rounded-full bg-text px-4 text-sm font-semibold text-night transition-colors hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:scale-95 motion-reduce:transition-none sm:flex"
          >
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}
