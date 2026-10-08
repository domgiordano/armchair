"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getEmailSettings, setEmailSettings, type EmailSettings, type EmailType } from "../api/email";

export type EmailLoad =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; settings: EmailSettings };

/**
 * The caller's email settings, with a toggle that flips at once and rolls back
 * if the save fails. `toggle` and `dismiss` reject with the API error so the
 * screen can say so.
 */
export function useEmailSettings() {
  const [load, setLoadState] = useState<EmailLoad>({ kind: "loading" });
  // What's on screen, for rolling back a failed save.
  const current = useRef<EmailLoad>(load);
  const setLoad = useCallback((next: EmailLoad) => {
    current.current = next;
    setLoadState(next);
  }, []);

  useEffect(() => {
    let live = true;
    getEmailSettings().then(
      (settings) => live && setLoad({ kind: "ready", settings }),
      (e: unknown) => live && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load" }),
    );
    return () => {
      live = false;
    };
  }, [setLoad]);

  const save = useCallback(
    async (change: Parameters<typeof setEmailSettings>[0], optimistic: (s: EmailSettings) => EmailSettings) => {
      const before = current.current;
      if (before.kind !== "ready") return;
      setLoad({ kind: "ready", settings: optimistic(before.settings) });
      try {
        setLoad({ kind: "ready", settings: await setEmailSettings(change) });
      } catch (e) {
        setLoad(before);
        throw e;
      }
    },
    [setLoad],
  );

  const toggle = useCallback(
    (type: EmailType, on: boolean) => save({ prefs: { [type]: on } }, (s) => ({ ...s, prefs: { ...s.prefs, [type]: on } })),
    [save],
  );
  const dismiss = useCallback(() => save({ noticeSeen: true }, (s) => ({ ...s, noticeSeen: true })), [save]);

  return { load, toggle, dismiss };
}

/** The settings rows each app shows, in order: its own show's types, then the family-wide ones. */
export const EMAIL_LABELS: Record<EmailType, { label: string; hint: string }> = {
  "dwts.tonight": { label: "Show-night reminder", hint: "Two hours before DWTS airs" },
  "dwts.closing": { label: "Before a week locks", hint: "Two days ahead, if you still have dances to score" },
  "dwts.digest": { label: "Weekly results", hint: "Your numbers and standings, never a spoiler" },
  "traitors.tonight": { label: "Release-night reminder", hint: "Two hours before new episodes drop" },
  "traitors.digest": { label: "Weekly results", hint: "Your points and standings, never a spoiler" },
  social: { label: "Invites and friend requests", hint: "When someone invites you or asks to be friends" },
  groups: { label: "Group activity", hint: "When someone in your group starts a show" },
};

export const SHOW_TYPES: Record<"dwts" | "traitors", EmailType[]> = {
  dwts: ["dwts.tonight", "dwts.closing", "dwts.digest", "social", "groups"],
  traitors: ["traitors.tonight", "traitors.digest", "social", "groups"],
};
