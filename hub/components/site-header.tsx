import Link from "next/link";

import { ChairMark } from "@/components/chair-mark";
import { DWTS_URL } from "@/lib/links";

const link =
  "flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-gold";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-gold">
          <ChairMark className="h-9 w-9" />
          <span className="text-base font-bold tracking-tight">
            Armchair <span className="text-brand-gradient">Judge</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/#how" className={`${link} hidden sm:flex`}>
            How it works
          </Link>
          <Link href="/#shows" className={`${link} hidden sm:flex`}>
            Shows
          </Link>
          <a
            href={DWTS_URL}
            className="ml-1 flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-gold active:scale-95"
          >
            Open DWTS
          </a>
        </nav>
      </div>
    </header>
  );
}
