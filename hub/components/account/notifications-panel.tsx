"use client";

import type { Notification } from "@/lib/api/social";
import { dwtsLink } from "@/lib/links";
import { appLink } from "@armchair/app-core/apps";
import { showName } from "@armchair/app-core/social/group-shows";
import { useAction } from "@/lib/load";
import { useNotifications } from "@/lib/notifications";

import { Empty, ErrorNote, PersonRow, PRIMARY, QUIET, SECONDARY, SkeletonRows } from "./ui";

const SHOWN = 6;

const TEXT: Record<Notification["type"], string> = {
  friend_request: "Wants to be friends",
  friend_accepted: "Accepted your friend request",
  group_invite: "Invited you to",
  group_join_request: "Asked to join",
  group_join_accepted: "Let you into",
  group_show_started: "Started",
};

export function describe(n: Notification): string {
  const group = n.group ? ` ${n.group.name ?? "a group"}` : "";
  if (n.type === "group_show_started") return `Started ${showName(n.show)} for${group}`;
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

/** The notifications list with its heading, inside the header bell's popover. */
export function NotificationsPanel({ titleId }: { titleId: string }) {
  const { items, unread, loaded, error, refresh, markAllRead } = useNotifications();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3 pl-2">
        <h2 id={titleId} className="text-base font-bold tracking-tight">
          Notifications
          {unread > 0 && (
            <span className="ml-2 inline-flex min-w-6 justify-center rounded-full bg-magenta/20 px-2 text-sm text-magenta tabular-nums">
              {unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </h2>
        {unread > 0 && (
          <button type="button" onClick={() => void markAllRead()} className={QUIET}>
            Mark all read
          </button>
        )}
      </div>
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
        <a href={dwtsLink("/notifications/")} className={`${QUIET} self-start`}>
          See all
        </a>
      )}
    </div>
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
      {item.type === "group_show_started" && item.group && (item.show === "dwts" || item.show === "traitors") && (
        <a href={appLink(item.show, "/groups/", { id: item.group.id }) ?? undefined} className={PRIMARY}>
          Join on {item.show === "dwts" ? "DWTS" : showName(item.show)}
        </a>
      )}
      {!item.read && !actionable && (
        <span aria-hidden="true" className="size-2 rounded-full bg-magenta shadow-[0_0_8px_var(--color-magenta)]" />
      )}
    </PersonRow>
  );
}
