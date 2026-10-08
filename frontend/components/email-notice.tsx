"use client";

import Link from "next/link";

import { useToast } from "@/components/ui/toast";
import { message } from "@/components/social/parts";
import { useEmailSettings } from "@armchair/app-core/email/use-email-settings";
import { button } from "@/lib/ui";

/** Once per account: says which emails are on before the first one arrives. */
export function EmailNotice() {
  const { load, dismiss } = useEmailSettings();
  const toast = useToast();
  if (load.kind !== "ready" || load.settings.noticeSeen) return null;

  return (
    <section
      aria-labelledby="email-notice-heading"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-gold/30 bg-ballroom/60 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <h2 id="email-notice-heading" className="text-sm font-semibold text-pearl">
          We&apos;ll email you show-night reminders and your weekly results
        </h2>
        <p className="text-sm text-silver-dim">
          Results emails never spoil a week you haven&apos;t finished. Turn any of them off in Settings.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/profile/#settings" className={button("secondary", "sm")}>
          Settings
        </Link>
        <button
          type="button"
          onClick={() => void dismiss().catch((e: unknown) => toast(message(e), "error"))}
          className={button("primary", "sm")}
        >
          Got it
        </button>
      </div>
    </section>
  );
}
