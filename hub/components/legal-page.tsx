import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const LAST_UPDATED = "2026-10-08";
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
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {LAST_UPDATED}</p>
        <div className="legal mt-10">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
