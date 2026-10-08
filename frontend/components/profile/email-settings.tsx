"use client";

import { Toggle } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { EMAIL_LABELS, SHOW_TYPES, useEmailSettings } from "@armchair/app-core/email/use-email-settings";
import type { EmailType } from "@armchair/app-core/api/email";
import { message } from "@/components/social/parts";
import { EYEBROW } from "@/lib/ui";

/** Which emails you get, inside the profile's Settings. Each switch saves as it flips. */
export function EmailSettings() {
  const { load, toggle } = useEmailSettings();
  const toast = useToast();

  if (load.kind === "loading") return <div className="h-40 w-full skeleton rounded-md" aria-label="Loading email settings" />;
  if (load.kind === "error") return <p className="text-sm text-silver-dim">Couldn&apos;t load your email settings. {load.message}</p>;

  const { settings } = load;
  const flip = (type: EmailType, on: boolean) => toggle(type, on).catch((e: unknown) => toast(message(e), "error"));

  return (
    <div className="flex w-full max-w-md flex-col gap-1">
      <h3 className={EYEBROW}>Email</h3>
      <p className="text-sm text-silver-dim">
        Sent to {settings.address ?? "your sign-in address"}. Every email has a one-tap unsubscribe too.
      </p>
      {settings.suppressed && (
        <p role="alert" className="text-sm text-stamp">
          Email to this address bounced or was marked as spam, so nothing more will be sent to it.
        </p>
      )}
      {SHOW_TYPES.dwts.map((type) => (
        <Toggle
          key={type}
          label={EMAIL_LABELS[type].label}
          hint={EMAIL_LABELS[type].hint}
          checked={settings.prefs[type]}
          onChange={(on) => void flip(type, on)}
        />
      ))}
    </div>
  );
}
