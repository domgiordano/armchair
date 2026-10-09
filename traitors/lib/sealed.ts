"use client";

import type { EventType } from "@/lib/api/traitors";
import { sealStore } from "@armchair/app-core/show/sealed";

// A sealed call keeps its episode's results face down: the outcome, everyone's calls,
// the recap, the points it scored, and who is gone from the episodes after it. The
// server holds the seals and keeps all of that out; this is the device's synced copy.
const store = sealStore("armchair.traitors.sealed", "traitors");

const id = (season: string, ep: number, type: EventType) => `${season}|${ep}|${type}`;

export const sealCall = (season: string, ep: number, type: EventType) => store.seal(id(season, ep, type));

export const revealCall = (season: string, ep: number, type: EventType) => store.reveal(id(season, ep, type));

export const revealEpisode = (season: string, ep: number) => store.revealEpisode(season, ep);

/** Bumps when the server confirms a seal or reveal: gated reads fetch again. */
export const useSealVersion = store.useVersion;

export interface FaceDown {
  /** Episodes of the season with a call still face down, in order. */
  eps: number[];
  call: (ep: number, type: EventType) => boolean;
  episode: (ep: number) => boolean;
}

/** Whether any call of an episode, in any season, is face down: for pages that span seasons. */
export function useFaceDownAny(): (season: string, ep: number) => boolean {
  const sealed = store.useSealed();
  return (season, ep) => [...sealed].some((x) => x.startsWith(`${season}|${ep}|`));
}

export function useFaceDown(season: string): FaceDown {
  const sealed = store.useSealed();
  const eps = [...sealed]
    .map((x) => x.split("|"))
    .filter(([s]) => s === season)
    .map(([, ep]) => Number(ep));
  const unique = [...new Set(eps)].sort((a, b) => a - b);
  return {
    eps: unique,
    call: (ep, type) => sealed.has(id(season, ep, type)),
    episode: (ep) => unique.includes(ep),
  };
}
