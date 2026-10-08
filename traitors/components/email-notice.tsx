"use client";

import Link from "next/link";

import { useEmailSettings } from "@armchair/app-core/email/use-email-settings";

import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { button } from "@/lib/ui";

/** Once per account: says which emails are on before the first one arrives. */
export function EmailNotice() {
  const { load, dismiss } = useEmailSettings();
  const toast = useToast();
  if (load.kind !== "ready" || load.settings.noticeSeen) return null;

  return (
    <Card
      as="section"
      tone="cloak"
      aria-labelledby="email-notice-heading"
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <h2 id="email-notice-heading" className="text-bone">
          We&apos;ll email you before new episodes drop, and your weekly results
        </h2>
        <p className="text-ash">Results emails never spoil an episode you haven&apos;t finished. Turn any of them off in Settings.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/settings/" className={button("outline", "sm")}>
          Settings
        </Link>
        <button
          type="button"
          onClick={() => void dismiss().catch((e: unknown) => toast(e instanceof Error ? e.message : "Couldn't save", "error"))}
          className={button("gold", "sm")}
        >
          Got it
        </button>
      </div>
    </Card>
  );
}
