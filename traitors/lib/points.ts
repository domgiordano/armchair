// The same rules as backend/lambdas/common/points.py, which decides the real score.
// See docs/features/traitors/PLAN.md, "Points".

import type { EpisodeEvent, RoundTableResult } from "@/lib/api/traitors";

export const BANISHED = 5;
const EXACT: Record<number, number> = { 2: 3, 3: 2 };
const IN_TOP3 = 1;
export const NIGHT = 4;
export const WINNER = 20;
export const FACTION = 10;
/** A right 2nd choice earns 60% of a right 1st, a 3rd 30%. */
export const RANK_SHARE = [1, 0.6, 0.3];

/** Each player's span of first-vote ranks. In 5-2-2 both twos hold 2-3, so either is exact for 2nd or 3rd. */
export function ranks(firstVote: Record<string, number>): Record<string, [number, number]> {
  const counts = Object.values(firstVote);
  return Object.fromEntries(
    Object.entries(firstVote).map(([p, n]) => [
      p,
      [1 + counts.filter((c) => c > n).length, counts.filter((c) => c >= n).length],
    ]),
  );
}

/** Slot 1 scores against who actually left; slots 2 and 3 against the first vote's ranks. */
export function roundTable(picks: string[], result: RoundTableResult): number {
  const spans = ranks(result.firstVote ?? {});
  return picks.reduce((total, p, i) => {
    const slot = i + 1;
    const [lo, hi] = spans[p] ?? [99, 99];
    if (slot === 1 && p === result.banished) return total + BANISHED;
    if (slot > 1 && lo <= slot && slot <= hi) return total + EXACT[slot];
    return lo <= 3 ? total + IN_TOP3 : total;
  }, 0);
}

/** Points for your pick on one event, or null when there's nothing to score yet. */
export function eventPoints(event: EpisodeEvent): number | null {
  const picks = event.mine?.picks;
  if (!picks || !event.result) return null;
  switch (event.type) {
    case "RT":
      return roundTable(picks, event.result);
    case "MURDER":
      return (event.result.victims ?? []).includes(picks[0]) ? NIGHT : 0;
    case "RECRUIT":
      return (event.result.recruits ?? []).includes(picks[0]) ? NIGHT : 0;
  }
}

/** A bet before the premiere is worth everything; each episode out takes a share off. */
export const multiplier = (episodes: number, released: number) => (episodes ? (episodes - released) / episodes : 0);

/** What a winner place is worth, rank 0 for 1st: the winner, and the extra for calling their side. */
export function placeWorth(rank: number, share: number): { winner: number; faction: number } {
  const m = RANK_SHARE[rank] * share;
  return { winner: Math.round(WINNER * m), faction: Math.round(FACTION * m) };
}
