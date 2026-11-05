import type { CrowdStats, EventType } from "@/lib/api/traitors";

export interface RatedCall {
  ep: number;
  type: EventType;
  voters: number;
  hits: number;
  rate: number;
}

export const rate = (hits: number, of: number) => (of ? hits / of : null);

/** The season's calls by crowd hit rate: the `n` fewest got right and the `n` most, never one in both. */
export function extremes(episodes: CrowdStats["episodes"], n = 3): { hardest: RatedCall[]; easiest: RatedCall[] } {
  const all = episodes
    .flatMap((e) => (Object.entries(e.calls) as [EventType, { voters: number; hits: number }][]).map(([type, c]) => ({ ep: e.ep, type, voters: c.voters, hits: c.hits, rate: c.hits / c.voters })))
    // More voters first on a tie: 0 of 9 says more than 0 of 1.
    .sort((a, b) => a.rate - b.rate || b.voters - a.voters);
  // Early in a season there are few calls: each list gets at most half.
  const k = Math.min(n, Math.floor(all.length / 2));
  const easiest = all
    .slice(k)
    .sort((a, b) => b.rate - a.rate || b.voters - a.voters)
    .slice(0, k);
  return { hardest: all.slice(0, k), easiest };
}
