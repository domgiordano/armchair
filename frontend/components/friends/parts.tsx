"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { Person } from "@/lib/api/social";
import { button, EYEBROW, INPUT } from "@/lib/ui";

export { FOCUS, INPUT } from "@/lib/ui";
export const SMALL_PRIMARY = button("primary", "sm");
export const SMALL_SECONDARY = button("secondary", "sm");
export const QUIET = button("ghost", "sm");
export const SECTION_TITLE = `${EYEBROW} pb-1`;

export const displayName = (p: Person) => p.name ?? "Someone";

export type Load<T> = { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };

export const message = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

/** Fetches on mount and on reload(); keeps the last good value on screen while reloading. */
export function useLoad<T>(fetcher: () => Promise<T>): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (value) => !cancelled && setLoad({ kind: "ready", value }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: message(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher, attempt]);

  return [load, useCallback(() => setAttempt((n) => n + 1), [])];
}

/** Runs one action at a time for a row, and keeps its error beside it. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

export function PersonRow({
  person,
  detail,
  children,
  error,
}: {
  person: Person;
  detail?: ReactNode;
  children?: ReactNode;
  error?: string | null;
}) {
  const name = displayName(person);
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      {/* Actions drop under the name when both won't fit, rather than truncating it. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-[8rem] flex-1 items-center gap-3">
          <Avatar name={name} email="" picture={person.picture} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-pearl">{name}</p>
            {detail && <p className="text-xs text-silver-dim">{detail}</p>}
          </div>
        </div>
        {children && <div className="ml-auto flex shrink-0 items-center gap-1.5">{children}</div>}
      </div>
      {error && (
        <p role="alert" className="pl-12 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** A destructive action that asks once more in place, rather than a modal. */
export function ConfirmButton({
  label,
  confirm,
  busy,
  onConfirm,
}: {
  label: string;
  confirm: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" disabled={busy} onClick={() => setAsking(true)} className={QUIET}>
        {label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className={`${button("danger", "sm")} animate-pop-in`}
      >
        {confirm}
      </button>
      <button type="button" disabled={busy} onClick={() => setAsking(false)} className={QUIET}>
        Keep
      </button>
    </span>
  );
}

export function CopyLink({ label, link }: { label: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("Link copied");
    } catch {
      // Clipboard refused: the link stays on screen to copy by hand.
      setCopied(false);
      toast("Couldn't copy. Select the link and copy it by hand.", "error");
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-silver-dim">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className={`${INPUT} min-w-0 font-mono text-sm text-silver`}
        />
        <button type="button" onClick={() => void copy()} className={`${button("secondary")} shrink-0 px-4 text-sm`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState compact>{children}</EmptyState>;
}
