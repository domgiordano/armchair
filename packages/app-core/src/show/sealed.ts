"use client";

import { useSyncExternalStore } from "react";

import { ApiError, request } from "../api/client";
import { invalidate } from "../api/cache";

/**
 * Answers locked in whose results stay face down until you choose to look. The server
 * holds them (/seals/*, backend common/seals.py) and keeps them out of every read, so a
 * reveal on one device turns the result over on the others. This is the device's copy:
 * it answers at once, and works offline, with every change since the last sync queued
 * and replayed in order. A device's seals from before the server held them are posted
 * once, the first time it syncs.
 */
export interface SealStore {
  seal: (id: string) => void;
  /**
   * Turns these over, sealed here or not: a card can come back sealed from another
   * device before this one syncs. Resolves once the server has it, or gave up for now.
   */
  reveal: (...ids: string[]) => Promise<void>;
  /** Turns over every seal of one episode, any device's. */
  revealEpisode: (season: string, ep: number) => Promise<void>;
  /** The sealed ids right now, for reads made outside React. */
  ids: () => readonly string[];
  /** The sealed ids. Nothing is sealed on the server render. */
  useSealed: () => ReadonlySet<string>;
  /** Bumps each time the server confirms a change: when gated reads should be fetched again. */
  useVersion: () => number;
  /** Sends what's queued, then takes the server's list. Runs on load, focus and reconnect. */
  sync: () => Promise<void>;
}

export type SealApp = "dwts" | "traitors";

type Op = { seal: string[] } | { reveal: string[] } | { season: string; ep: number };

// Far under the server's cap (seals.MAX), so a migration never trips it.
const MIGRATE_MAX = 500;
// Focus and visibility fire together; one sync covers both.
const SYNC_GAP_MS = 5_000;

const parse = <T>(s: string | null, fallback: T): T => {
  try {
    return s === null ? fallback : (JSON.parse(s) as T);
  } catch {
    return fallback;
  }
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function apply(ids: readonly string[], op: Op): string[] {
  if ("seal" in op) return [...ids, ...op.seal.filter((id) => !ids.includes(id))];
  if ("reveal" in op) return ids.filter((id) => !op.reveal.includes(id));
  return ids.filter((id) => !id.startsWith(`${op.season}|${op.ep}|`));
}

/** A 4xx other than signed out, no profile yet or rate limited: retrying won't help. */
const hopeless = (e: unknown) =>
  e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 404, 429].includes(e.status);

export function sealStore(key: string, app: SealApp): SealStore {
  const keys = { ids: key, pending: `${key}.pending`, migrated: `${key}.migrated` };
  const listeners = new Set<() => void>();
  // Storage throws when disabled (Safari private mode); state then lasts until the tab closes.
  const fallback = new Map<string, string>();
  const get = (k: string): string | null => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return fallback.get(k) ?? null;
    }
  };
  const set = (k: string, v: string) => {
    fallback.set(k, v);
    try {
      window.localStorage.setItem(k, v);
    } catch {
      // See get.
    }
  };

  const raw = () => get(keys.ids) ?? "[]";
  let version = 0;
  const ids = () => strings(parse(raw(), []));
  const pending = () => parse<Op[]>(get(keys.pending), []);
  const write = (next: string[]) => {
    set(keys.ids, JSON.stringify(next));
    listeners.forEach((l) => l());
  };
  const enqueue = (op: Op) => {
    set(keys.pending, JSON.stringify([...pending(), op]));
    write(apply(ids(), op));
  };

  const send = (op: Op) =>
    request<{ sealed: string[] }>(`/seals/${"seal" in op ? "seal" : "reveal"}`, {
      method: "POST",
      body: JSON.stringify("seal" in op ? { app, ids: op.seal } : "reveal" in op ? { app, ids: op.reveal } : { app, ...op }),
    });

  /** True once nothing is left queued. */
  const drain = async (): Promise<boolean> => {
    for (let queue = pending(); queue.length > 0; queue = pending()) {
      let held: string[] | null = null;
      try {
        held = (await send(queue[0])).sealed;
      } catch (e) {
        if (!hopeless(e)) return false;
      }
      const rest = pending().slice(1);
      set(keys.pending, JSON.stringify(rest));
      if (held !== null) {
        version += 1;
        write(rest.reduce(apply, held));
      }
    }
    return true;
  };
  // One drain at a time, so the queue goes up in order.
  let flushing: Promise<boolean> | null = null;
  const flush = (): Promise<boolean> => {
    flushing ??= drain().finally(() => {
      flushing = null;
    });
    return flushing;
  };

  // Seals from before the server held them go up once, ahead of anything new.
  if (typeof window !== "undefined" && get(keys.migrated) === null) {
    const local = ids();
    if (local.length > 0) set(keys.pending, JSON.stringify([{ seal: local.slice(-MIGRATE_MAX) }, ...pending()]));
    set(keys.migrated, "1");
  }

  let lastSync = 0;
  const sync = async () => {
    lastSync = Date.now();
    if (!(await flush())) return;
    const before = version;
    let held: string[];
    try {
      held = (await request<{ sealed: string[] }>(`/seals/list?app=${app}`)).sealed;
    } catch {
      return;
    }
    // The server answered a change while the list was in flight: the list is older.
    if (version !== before) return;
    // A change made meanwhile and still queued stays on top.
    const next = pending().reduce(apply, held);
    const now = ids();
    if (next.length === now.length && next.every((id) => now.includes(id))) return;
    version += 1;
    write(next);
    // Reads cached before another device revealed (or sealed) are out of date.
    invalidate();
  };

  let watching = false;
  const watch = () => {
    if (watching) return;
    watching = true;
    const again = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > SYNC_GAP_MS) void sync();
    };
    window.addEventListener("focus", again);
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", again);
    void sync();
  };

  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    watch();
    // Another tab sealing or revealing shows here too.
    const onStorage = (e: StorageEvent) => e.key === keys.ids && fn();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  };

  // One Set per snapshot string, so every render of an unchanged store sees the same object.
  let last: { raw: string; ids: ReadonlySet<string> } = { raw: "[]", ids: new Set() };
  const snapshot = (s: string) => {
    if (s !== last.raw) last = { raw: s, ids: new Set(strings(parse(s, []))) };
    return last.ids;
  };

  return {
    seal(id) {
      if (ids().includes(id)) return;
      enqueue({ seal: [id] });
      void flush();
    },
    async reveal(...gone) {
      if (gone.length === 0) return;
      enqueue({ reveal: gone });
      await flush();
    },
    async revealEpisode(season, ep) {
      enqueue({ season, ep });
      await flush();
    },
    ids,
    useSealed() {
      return snapshot(useSyncExternalStore(subscribe, raw, () => "[]"));
    },
    useVersion() {
      return useSyncExternalStore(subscribe, () => version, () => 0);
    },
    sync,
  };
}
