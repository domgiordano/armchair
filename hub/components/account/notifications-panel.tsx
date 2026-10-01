"use client";

import type { Notification } from "@/lib/api/social";
import { dwtsLink } from "@/lib/links";
import { useAction } from "@/lib/load";
import { useNotifications } from "@/lib/notifications";

import { Empty, ErrorNote, PersonRow, PRIMARY, QUIET, SECONDARY, SkeletonRows, Panel } from "./ui";

const SHOWN = 6;

const TEXT: Record<Notification["type"], string> = {
  friend_request: "Wants to be friends",
  friend_accepted: "Accepted your friend request",
  group_invite: "Invited you to",
  group_join_request: "Asked to join",
  group_join_accepted: "Let you into",
};

export function describe(n: Notification): string {
  const group = n.group ? ` ${n.group.name ?? "a group"}` : "";
  return `${TEXT[n.type]}${group}`;
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

export function NotificationsPanel({ index }: { index: number }) {
  const { items, unread, loaded, error, refresh, markAllRead } = useNotifications();

  return (
    <Panel
      id="notifications"
      title="Notifications"
      count={unread}
      countLabel="unread"
      index={index}
      action={
        unread > 0 && (
          <button type="button" onClick={() => void markAllRead()} className={QUIET}>
            Mark all read
          </button>
        )
      }
    >
      {!loaded && <SkeletonRows label="Loading notifications" />}
      {loaded && error !== null && items.length === 0 && (
        <ErrorNote what="notifications" message={error} retry={() => void refresh()} />
      )}
      {loaded && error === null && items.length === 0 && (
        <Empty>Nothing yet. Friend requests and group invites land here.</Empty>
      )}
      {items.length > 0 && (
        <ul aria-label="Recent notifications" className="divide-y divide-line/70">
          {items.slice(0, SHOWN).map((n) => (
            <li key={n.id} className="relative">
              <Item item={n} />
            </li>
          ))}
        </ul>
      )}
      {items.length > SHOWN && (
        <a href={dwtsLink("/notifications/")} className={`${QUIET} -ml-3 self-start`}>
          See all
        </a>
      )}
    </Panel>
  );
}

function Item({ item }: { item: Notification }) {
  const { answer } = useNotifications();
  const { busy, error, run } = useAction();
  const actionable = item.state === "pending" && item.type !== "friend_accepted" && item.type !== "group_join_accepted";

  return (
    <PersonRow
      person={item.from}
      error={error}
      detail={
        <>
          {describe(item)} &middot; <time dateTime={item.at}>{timeAgo(item.at)}</time>
          {!item.read && <span className="sr-only">, new</span>}
          {item.state === "accepted" && <span className="text-gold"> &middot; Accepted</span>}
          {item.state === "declined" && <span> &middot; Declined</span>}
        </>
      }
    >
      {actionable && (
        <>
          <button type="button" disabled={busy !== null} onClick={() => void run("accept", () => answer(item, true))} className={PRIMARY}>
            {busy === "accept" ? "Accepting..." : "Accept"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void run("decline", () => answer(item, false))} className={SECONDARY}>
            Decline
          </button>
        </>
      )}
      {!item.read && !actionable && (
        <span aria-hidden="true" className="size-2 rounded-full bg-magenta shadow-[0_0_8px_var(--color-magenta)]" />
      )}
    </PersonRow>
  );
}
