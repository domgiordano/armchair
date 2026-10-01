import Link from "next/link";

import { ChairMark } from "@/components/chair-mark";

const link =
  "-ml-2 flex min-h-11 items-center rounded-full px-2 text-muted underline-offset-4 transition-colors hover:text-gold hover:underline focus-visible:outline-2 focus-visible:outline-gold motion-reduce:transition-none";

// Stamped when the static page is built.
const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <ChairMark className="h-10 w-10" />
          <div>
            <p className="font-bold tracking-tight">
              Armchair <span className="text-brand-gradient">Judge</span>
            </p>
            <p className="text-[11px] font-medium tracking-[0.3em] text-muted">DISCOVER / WATCH / JUDGE</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-xs leading-relaxed text-muted">
            Not affiliated with ABC, Disney, BBC, Peacock, CBS or the shows&rsquo; producers. Show names are used to
            describe what you can rate.
          </p>
          <nav aria-label="Legal" className="mt-3 flex gap-2 text-sm">
            <Link href="/privacy/" className={link}>
              Privacy
            </Link>
            <Link href="/terms/" className={link}>
              Terms
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-line/60">
        <p className="mx-auto max-w-6xl px-6 py-5 text-xs text-muted">
          &copy; {YEAR} Armchair Judge &middot; An independent fan project
        </p>
      </div>
    </footer>
  );
}
