"use client";

import type { EmailType } from "@armchair/app-core/api/email";
import { EMAIL_LABELS, SHOW_TYPES, useEmailSettings } from "@armchair/app-core/email/use-email-settings";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { EYEBROW } from "@/lib/ui";

/** Which Traitors emails you get. Each switch saves as it flips. */
export function SettingsScreen() {
  const { load, toggle } = useEmailSettings();
  const toast = useToast();

  if (load.kind === "loading") return <div className="h-64 skeleton rounded-sm" aria-label="Loading your settings" />;
  if (load.kind === "error") return <ErrorState what="your settings" message={load.message} retry={() => window.location.reload()} />;

  const { settings } = load;
  const flip = (type: EmailType, on: boolean) =>
    toggle(type, on).catch((e: unknown) => toast(e instanceof Error ? e.message : "Couldn't save", "error"));

  return (
    <Card as="section" aria-labelledby="email-heading" className="flex max-w-xl flex-col gap-2">
      <h2 id="email-heading" className={EYEBROW}>
        Email
      </h2>
      <p className="text-ash">
        Sent to {settings.address ?? "your sign-in address"}. Every email has a one-tap unsubscribe too.
      </p>
      {settings.suppressed && (
        <p role="alert" className="text-blood-hi">
          Email to this address bounced or was marked as spam, so nothing more will be sent to it.
        </p>
      )}
      {SHOW_TYPES.traitors.map((type) => (
        <Toggle
          key={type}
          label={EMAIL_LABELS[type].label}
          hint={EMAIL_LABELS[type].hint}
          checked={settings.prefs[type]}
          onChange={(on) => void flip(type, on)}
        />
      ))}
    </Card>
  );
}
