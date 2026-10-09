"use client";

import { sealStore } from "@armchair/app-core/show/sealed";

/**
 * Dances locked in but not yet revealed. The server holds them and keeps their
 * judges out of every read, on every device; this is the device's synced copy
 * (app-core show/sealed.ts), which answers at once and covers the moment before
 * the server has a new seal.
 */
const store = sealStore("armchair.sealed", "dwts");

const id = (season: string, ep: number, key: string) => `${season}|${ep}|${key}`;

export const seal = (season: string, ep: number, key: string): void => store.seal(id(season, ep, key));

export const unseal = (season: string, ep: number, key: string): Promise<void> => store.reveal(id(season, ep, key));

/**
 * An episode's results, held back from its last answer until "Reveal results".
 * Shaped like a dance key so gate.sealed_param and the server's seal ids take
 * it as one: the server then keeps that night's eliminations back too.
 */
export const RESULTS = "results#0";

export const holdResults = (season: string, ep: number) => seal(season, ep, RESULTS);

export const revealResults = (season: string, ep: number) => unseal(season, ep, RESULTS);

/** Bumps when the server confirms a seal or reveal: gated reads fetch again. */
export const useSealVersion = store.useVersion;

/** Lookups over the sealed list, for API reads that must leave those dances' judges out. */
export interface Seals {
  none: boolean;
  dance: (season: string, ep: number, key: string) => boolean;
  /** Whether any dance of the couple `id` is sealed, in any episode of `season`. */
  couple: (season: string, id: string) => boolean;
  /** Whether anything of the episode is face down: a dance, or its results. */
  episode: (season: string, ep: number) => boolean;
}

export function sealsFrom(ids: readonly string[]): Seals {
  const parts = ids.map((x) => {
    const [season, ep, key] = x.split("|");
    // A team dance's key names every member couple: "a+b+c#1".
    const couples = key === RESULTS ? [] : key.slice(0, key.lastIndexOf("#")).split("+");
    return { season, ep: Number(ep), key, couples };
  });
  return {
    none: ids.length === 0,
    dance: (season, ep, key) => ids.includes(id(season, ep, key)),
    couple: (season, cid) => parts.some((p) => p.season === season && p.couples.includes(cid)),
    episode: (season, ep) => parts.some((p) => p.season === season && p.ep === ep),
  };
}

const now = (): readonly string[] => (typeof window === "undefined" ? [] : store.ids());

/** The seals as stored right now. Read at fetch time, so a reveal shows on the next read. */
export const currentSeals = (): Seals => sealsFrom(now());

/** Whether a dance in `season` is sealed. Nothing is sealed on the server render. */
export function useSealed(): (season: string, ep: number, key: string) => boolean {
  const ids = store.useSealed();
  return (season, ep, key) => ids.has(id(season, ep, key));
}

/**
 * The `sealed` query param for a read of `season`, "6:key,7:key". The server
 * applies the seals it holds; this adds any it doesn't have yet. "all" takes
 * every season's.
 */
export function sealedParam(season: string): string {
  return now()
    .map((x) => x.split("|"))
    .filter(([s]) => season === "all" || s === season)
    .map(([, ep, key]) => `${ep}:${key}`)
    .join(",");
}

/** Episodes of `season` holding a sealed dance: what the odds board must not count yet. */
export function useSealedEpisodes(season: string): number[] {
  const eps = [...store.useSealed()]
    .map((x) => x.split("|"))
    .filter(([s]) => s === season)
    .map(([, ep]) => Number(ep));
  return [...new Set(eps)].sort((a, b) => a - b);
}
