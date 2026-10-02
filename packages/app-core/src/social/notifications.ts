"use client";

import { useEffect, useSyncExternalStore } from "react";

import { manageGroup, respondToInvite } from "../api/groups";
import {
  acceptFriend,
  getNotifications,
  markNotificationsRead,
  removeFriend,
  type Notification,
} from "../api/social";

export interface Notifications {
  unread: number;
  items: Notification[];
  /** False until the first fetch lands, so a bell can hold its badge. */
  loaded: boolean;
  error: string | null;
  /** True when there are older ones than the newest 50 shown. */
  more: boolean;
  /** One notification, or every unread one when called with no id. */
  markRead: (id?: string) => Promise<void>;
  /** Accept or decline a request or invite, in place. */
  answer: (item: Notification, accept: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

type Snapshot = Pick<Notifications, "unread" | "items" | "loaded" | "error" | "more">;

const POLL_MS = 60_000;
const EMPTY: Snapshot = { unread: 0, items: [], loaded: false, error: null, more: false };

// One store for the whole page: the bell, the panel and the full page all read
// the same list, and only one poll runs however many of them are mounted.
let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

async function refresh() {
  try {
    const page = await getNotifications();
    set({ items: page.items, unread: page.unread, more: page.next !== null, loaded: true, error: null });
  } catch (e) {
    set({ loaded: true, error: e instanceof Error ? e.message : "Request failed" });
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") void refresh();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refresh();
    timer = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisible);
  };
}

async function markRead(id?: string) {
  const hit = (n: Notification) => !n.read && (id === undefined || n.id === id);
  if (!snapshot.items.some(hit)) return;
  const items = snapshot.items.map((n) => (hit(n) ? { ...n, read: true } : n));
  set({ items, unread: id === undefined ? 0 : Math.max(0, snapshot.unread - 1) });
  try {
    await markNotificationsRead(id);
  } catch {
    // The optimistic state was wrong; take the server's word for it.
    await refresh();
  }
}

async function answer(item: Notification, accept: boolean) {
  const { from, group } = item;
  if (item.type === "friend_request") {
    await (accept ? acceptFriend(from.sub) : removeFriend(from.sub));
  } else if (item.type === "group_invite" && group) {
    await respondToInvite(group.id, accept);
  } else if (item.type === "group_join_request" && group) {
    await manageGroup(group.id, { action: accept ? "approve" : "deny", sub: from.sub });
  } else {
    return;
  }
  const state = accept ? "accepted" : "declined";
  set({
    items: snapshot.items.map((n) => (n.id === item.id ? { ...n, state, read: true } : n)),
    unread: item.read ? snapshot.unread : Math.max(0, snapshot.unread - 1),
  });
  await refresh();
}

export function useNotifications(): Notifications {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  return { ...s, markRead, answer, refresh };
}

/** Marks everything read once the list has been shown, as opening the panel or page does. */
export function useMarkAllReadOnView(active: boolean) {
  const { loaded, unread } = useNotifications();
  useEffect(() => {
    if (active && loaded && unread > 0) void markRead();
  }, [active, loaded, unread]);
}

/** Test seam: drop the shared state between tests. */
export function resetNotifications() {
  snapshot = EMPTY;
}
