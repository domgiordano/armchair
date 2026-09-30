"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { ErrorState } from "@/components/ui/states";
import { SignedIn } from "@/components/signed-in";
import type { Notification } from "@/lib/api/social";
import { useMarkAllReadOnView, useNotifications } from "@/lib/social/notifications";
import { PRIMARY, SECONDARY, TEXT_LINK } from "@/lib/ui";

const FOCUS = "focus-ring";
const SMALL = "min-h-11 px-4 text-sm";

export function NotificationsScreen() {
  return (
    <SignedIn title="Notifications">
      <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
      <NotificationList />
    </SignedIn>
  );
}

/** What happened, as a sentence with the names in bold. */
export function describe(n: Notification): { who: string; text: string; group: string | null } {
  const who = n.from.name ?? "Someone";
  const group = n.group ? (n.group.name ?? "a group") : null;
  const text = {
    friend_request: "wants to be friends",
    friend_accepted: "accepted your friend request",
    group_invite: "invited you to",
    group_join_request: "asked to join",
    group_join_accepted: "let you into",
  }[n.type];
  return { who, text, group };
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Every notification, unread first. Viewing the list marks them read, but the
 * ones that were unread when it opened stay highlighted until it closes.
 */
export function NotificationList({ compact = false }: { compact?: boolean }) {
  const { items, loaded, error, more, refresh } = useNotifications();
  const [fresh, setFresh] = useState<Set<string> | null>(null);

  // Taken once, during render, the first time the list is there to look at.
  if (loaded && fresh === null) setFresh(new Set(items.filter((n) => !n.read).map((n) => n.id)));
  useMarkAllReadOnView(fresh !== null);

  if (!loaded) return <p className="px-1 text-sm text-neutral-400">Loading notifications...</p>;
  if (error !== null && items.length === 0) {
    return <ErrorState what="notifications" message={error} retry={() => void refresh()} />;
  }
  if (items.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-neutral-400">
        Nothing yet. Friend requests and group invites show up here.
      </p>
    );
  }
  return (
    <>
      <ul aria-label="Notifications" className={`flex flex-col ${compact ? "" : "gap-2"}`}>
        {items.map((n) => (
          <li key={n.id}>
            <NotificationItem item={n} fresh={fresh?.has(n.id) ?? false} compact={compact} />
          </li>
        ))}
      </ul>
      {more && !compact && (
        <p className="text-center text-xs text-neutral-500">Showing the latest 50.</p>
      )}
    </>
  );
}

function NotificationItem({ item, fresh, compact }: { item: Notification; fresh: boolean; compact: boolean }) {
  const { answer } = useNotifications();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { who, text, group } = describe(item);

  const act = async (accept: boolean) => {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      await answer(item, accept);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      aria-label={`${who} ${text}${group ? ` ${group}` : ""}`}
      className={`flex gap-3 rounded-lg p-3 ${compact ? "" : "border border-neutral-800"} ${
        fresh ? "bg-ballroom/70" : ""
      }`}
    >
      <Avatar name={who} email="" picture={item.from.picture} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm leading-snug text-neutral-300">
          <span className="font-semibold text-neutral-100">{who}</span> {text}
          {group && <span className="font-semibold text-neutral-100"> {group}</span>}
          <span className="mt-0.5 block text-xs text-neutral-500">
            <time dateTime={item.at}>{timeAgo(item.at)}</time>
            {fresh && <span className="sr-only">, new</span>}
          </span>
        </p>
        {item.state === "pending" && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act(true)}
              className={`${PRIMARY} ${SMALL}`}
            >
              {busy === "accept" ? "Accepting..." : "Accept"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act(false)}
              className={`${SECONDARY} ${SMALL}`}
            >
              {busy === "decline" ? "Declining..." : "Decline"}
            </button>
          </div>
        )}
        {item.state === "accepted" && <p className="text-xs font-medium text-gold">Accepted</p>}
        {item.state === "declined" && <p className="text-xs text-neutral-500">Declined</p>}
        {error !== null && (
          <p role="alert" className="text-sm text-amber-200">
            {error}
          </p>
        )}
      </div>
      {fresh && <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-brand-magenta" />}
    </article>
  );
}

/**
 * The header bell: a panel under it on desktop, the full page on a phone,
 * where a dropdown would have no room for the actions.
 */
export function NotificationsBell() {
  const { unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  const icon = "relative flex size-11 shrink-0 items-center justify-center rounded-full text-silver transition-colors hover:bg-silver/10 hover:text-pearl active:bg-silver/15";

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Link href="/notifications/" aria-label={label} className={`${icon} md:hidden ${FOCUS}`}>
        <BellIcon />
        <Badge unread={unread} />
      </Link>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`${icon} hidden md:flex aria-expanded:bg-silver/10 ${FOCUS}`}
      >
        <BellIcon />
        <Badge unread={unread} />
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label="Notifications"
          className="absolute top-full right-0 z-30 mt-2 flex max-h-[min(34rem,80vh)] w-96 origin-top-right flex-col rounded-xl border border-silver/15 bg-ballroom shadow-2xl shadow-ink/70 animate-pop-in"
        >
          <div className="flex items-center justify-between border-b border-silver/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-pearl">Notifications</h2>
            <Link
              href="/notifications/"
              onClick={() => setOpen(false)}
              className={TEXT_LINK}
            >
              See all
            </Link>
          </div>
          <div className="overflow-y-auto p-1">
            <NotificationList compact />
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-magenta px-1 text-[10px] leading-none font-semibold text-pearl tabular-nums ring-2 ring-ink animate-pop-in"
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
}

function BellIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
