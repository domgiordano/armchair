"use client";

import { useSyncExternalStore } from "react";

/**
 * Dances locked in but not yet revealed. The server shows the judges as soon as
 * you answer; this keeps them face down until you choose to look, across
 * reloads. Only dances locked on this device are listed, so older answers and
 * other devices show as they always did.
 */
const KEY = "armchair.sealed";
const listeners = new Set<() => void>();

const id = (season: string, ep: number, key: string) => `${season}|${ep}|${key}`;

// Storage throws when disabled (Safari private mode); the seal then lasts until the tab closes.
let fallback = "[]";
function raw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return fallback;
  }
}

function write(ids: string[]): void {
  fallback = JSON.stringify(ids);
  try {
    window.localStorage.setItem(KEY, fallback);
  } catch {
    // See raw().
  }
  listeners.forEach((l) => l());
}

const parse = (s: string): string[] => {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function seal(season: string, ep: number, key: string): void {
  const ids = parse(raw());
  if (!ids.includes(id(season, ep, key))) write([...ids, id(season, ep, key)]);
}

export function unseal(season: string, ep: number, key: string): void {
  write(parse(raw()).filter((x) => x !== id(season, ep, key)));
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab revealing a dance reveals it here too.
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Lookups over the sealed list, for API reads that must leave those dances' judges out. */
export interface Seals {
  none: boolean;
  dance: (season: string, ep: number, key: string) => boolean;
  /** Whether any dance of the couple `id` is sealed, in any episode of `season`. */
  couple: (season: string, id: string) => boolean;
  episode: (season: string, ep: number) => boolean;
}

export function sealsFrom(ids: string[]): Seals {
  const parts = ids.map((x) => {
    const [season, ep, key] = x.split("|");
    // A team dance's key names every member couple: "a+b+c#1".
    return { season, ep: Number(ep), key, couples: key.slice(0, key.lastIndexOf("#")).split("+") };
  });
  return {
    none: ids.length === 0,
    dance: (season, ep, key) => ids.includes(id(season, ep, key)),
    couple: (season, cid) => parts.some((p) => p.season === season && p.couples.includes(cid)),
    episode: (season, ep) => parts.some((p) => p.season === season && p.ep === ep),
  };
}

/** The seals as stored right now. Read at fetch time, so a reveal shows on the next read. */
export const currentSeals = (): Seals => sealsFrom(typeof window === "undefined" ? [] : parse(raw()));

/** Whether a dance in `season` is sealed. Nothing is sealed on the server render. */
export function useSealed(): (season: string, ep: number, key: string) => boolean {
  const snapshot = useSyncExternalStore(subscribe, raw, () => "[]");
  const ids = new Set(parse(snapshot));
  return (season, ep, key) => ids.has(id(season, ep, key));
}

/** Episodes of `season` holding a sealed dance: what the odds board must not count yet. */
export function useSealedEpisodes(season: string): number[] {
  const snapshot = useSyncExternalStore(subscribe, raw, () => "[]");
  const eps = parse(snapshot)
    .map((x) => x.split("|"))
    .filter(([s]) => s === season)
    .map(([, ep]) => Number(ep));
  return [...new Set(eps)].sort((a, b) => a - b);
}
