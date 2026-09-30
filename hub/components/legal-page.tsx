import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const LAST_UPDATED = "2026-09-30";
export const ISSUES_URL = "https://github.com/domgiordano/armchair/issues";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-muted transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-gold motion-reduce:transition-none"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M13 8H3m4-4L3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Armchair Judge
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {LAST_UPDATED}</p>
        <div className="legal mt-10">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
