"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { UserLink } from "@/components/user-link";
import type { Friends, Person, Relation } from "@armchair/app-core/api/social";
import { useNotifications } from "@armchair/app-core/social/notifications";
import { button, cn, EYEBROW, INPUT } from "@/lib/ui";

export { FOCUS, INPUT } from "@/lib/ui";
export const SMALL_PRIMARY = button("primary", "sm");
export const SMALL_SECONDARY = button("secondary", "sm");
export const QUIET = button("ghost", "sm");
export const SECTION_TITLE = `${EYEBROW} pb-1`;

export const displayName = (p: Person) => p.name ?? "Someone";

/** Where the caller stands with `sub`, read off their own friends list. */
export function relationOf(friends: Friends, sub: string): Relation {
  const has = (list: Person[]) => list.some((p) => p.sub === sub);
  if (has(friends.friends)) return "friend";
  if (has(friends.incoming)) return "incoming";
  if (has(friends.outgoing)) return "outgoing";
  if (has(friends.blocked)) return "blocked";
  return null;
}

export type Load<T> = { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };

/** Friend requests and group invites waiting on you: the Requests badge everywhere it shows. */
export function useWaiting(friends: Load<Friends>): number {
  const { items } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending").length;
  return (friends.kind === "ready" ? friends.value.incoming.length : 0) + invites;
}

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
            <p className="truncate font-medium text-pearl">
              <UserLink sub={person.sub}>{name}</UserLink>
            </p>
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

const noop = () => () => {};
const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** A read-only link with Copy, and Share where the device has a share sheet. */
export function CopyLink({ label, link, share }: { label: string; link: string; share?: { title: string; text: string } }) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  const toast = useToast();
  const sharable = useSyncExternalStore(noop, canShare, () => false) && share !== undefined;
  const send = async () => {
    try {
      // iMessage and WhatsApp drop `title`; `text` is what lands in the message body.
      await navigator.share({ ...share, url: link });
    } catch (e) {
      // Closing the share sheet rejects with AbortError; that's a choice, not a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) toast("Couldn't open sharing. Copy the link instead.", "error");
    }
  };
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
        {sharable && (
          <button type="button" onClick={() => void send()} className={`${button("primary")} shrink-0 px-4 text-sm`}>
            Share
          </button>
        )}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState compact>{children}</EmptyState>;
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("size-4 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

/** Overlapping faces, decorative: the text beside them carries the names. */
export function AvatarStack({ people, size = 28, max = 4 }: { people: Person[]; size?: number; max?: number }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-2">
      {people.slice(0, max).map((p) => (
        <span key={p.sub} className="rounded-full ring-2 ring-ink">
          <Avatar name={displayName(p)} email="" picture={p.picture} size={size} />
        </span>
      ))}
    </span>
  );
}

/** A group's face: its first letter on a gold tile. */
export function GroupMark({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border border-gold/35 bg-gradient-to-br from-gold/25 via-ballroom to-brand-violet/20 font-semibold text-gold-light",
        size === "lg" ? "size-24 rounded-3xl text-4xl shadow-[0_0_34px_-8px_rgb(232_194_104/0.55)] sm:size-28" : "size-10 rounded-xl text-base",
      )}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** A titled list with its count: "MEMBERS 4". */
export function ListSection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className={SECTION_TITLE}>
        {title} {count !== undefined && <span className="text-gold tabular-nums">{count}</span>}
      </h3>
      <ul className="stagger divide-y divide-silver/10">{children}</ul>
    </section>
  );
}
