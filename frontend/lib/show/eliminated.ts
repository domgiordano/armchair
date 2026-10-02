"use client";

import { useState } from "react";

import type { CoupleSummary, Elimination } from "@/lib/api/couples";

export type EliminatedView = "couples" | "week-board" | "standings" | "performers" | "favorites";

/** The roster and leaderboards keep the eliminated couples, at the end; stats leave them out until asked. */
export const SHOW_ELIMINATED: Record<EliminatedView, boolean> = {
  couples: true,
  "week-board": true,
  standings: true,
  performers: false,
  favorites: false,
};

const key = (view: EliminatedView) => `armchair.showEliminated.${view}`;

// Storage throws when it is disabled or full (Safari private mode among them);
// the choice then lasts only as long as the page.
export function readShowEliminated(view: EliminatedView): boolean {
  try {
    const stored = window.localStorage.getItem(key(view));
    return stored === null ? SHOW_ELIMINATED[view] : stored === "1";
  } catch {
    return SHOW_ELIMINATED[view];
  }
}

/** The view's "Show eliminated" switch, remembered per view. */
export function useShowEliminated(view: EliminatedView): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => readShowEliminated(view));
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(key(view), next ? "1" : "0");
    } catch {
      // See readShowEliminated.
    }
    setOn(next);
  };
  return [on, set];
}

/** Couples still dancing in their order, then the eliminated ones in theirs, or without them when hidden. */
export function eliminatedLast<T>(items: T[], out: (item: T) => boolean, show: boolean): T[] {
  const dancing = items.filter((i) => !out(i));
  return show ? [...dancing, ...items.filter(out)] : dancing;
}

/** "Week 4", or "Episode 6" when the episode has no week. */
export const eliminatedWhen = (e: Elimination) => (e.week === null ? `Episode ${e.ep}` : `Week ${e.week}`);

const HIGHLIGHTS = 3;

/**
 * performers_get's favorites, least favorites, softer-on and tougher-on, over
 * the couples shown, so hiding the eliminated ones refills the lists.
 */
export function highlights<C extends CoupleSummary>(couples: C[]) {
  const rated = [...couples].sort((a, b) => b.you - a.you || b.dances - a.dances);
  const gapped = couples.filter((c) => c.gap !== null).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  return {
    favorites: rated.slice(0, HIGHLIGHTS),
    leastFavorites: rated.slice(HIGHLIGHTS).reverse().slice(0, HIGHLIGHTS),
    softerOn: gapped.filter((c) => (c.gap ?? 0) > 0).slice(0, HIGHLIGHTS),
    tougherOn: gapped
      .filter((c) => (c.gap ?? 0) < 0)
      .reverse()
      .slice(0, HIGHLIGHTS),
  };
}
