"use client";

import { useSyncExternalStore } from "react";

import { manageGroup, respondToInvite } from "@/lib/api/groups";
import { acceptFriend, getNotifications, markNotificationsRead, removeFriend, type Notification } from "@/lib/api/social";

// The DWTS app's store (frontend/lib/social/notifications.ts) without its
// polling: the dashboard reads it once and refreshes after each answer.

export interface Notifications {
  unread: number;
  items: Notification[];
  loaded: boolean;
  error: string | null;
  markAllRead: () => Promise<void>;
  /** Accept or decline a request or invite, in place. */
  answer: (item: Notification, accept: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

type Snapshot = Pick<Notifications, "unread" | "items" | "loaded" | "error">;

const EMPTY: Snapshot = { unread: 0, items: [], loaded: false, error: null };

// One store for the page: the friends, groups and notifications panels all
// read the same list, so an invite answered in one leaves the others.
let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();
const changed = new Set<() => void>();

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

async function refresh() {
  try {
    const page = await getNotifications();
    set({ items: page.items, unread: page.unread, loaded: true, error: null });
  } catch (e) {
    set({ loaded: true, error: e instanceof Error ? e.message : "Request failed" });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && !snapshot.loaded) void refresh();
  return () => {
    listeners.delete(listener);
  };
}

async function markAllRead() {
  if (snapshot.unread === 0) return;
  set({ items: snapshot.items.map((n) => ({ ...n, read: true })), unread: 0 });
  try {
    await markNotificationsRead();
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
  changed.forEach((fn) => fn());
  await refresh();
}

export function useNotifications(): Notifications {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  return { ...s, markAllRead, answer, refresh };
}

/** Runs `fn` after any answer, so a panel showing the same people can reload. */
export function onAnswered(fn: () => void): () => void {
  changed.add(fn);
  return () => {
    changed.delete(fn);
  };
}

/** Test seam: drop the shared state between tests. */
export function resetNotifications() {
  snapshot = EMPTY;
}
