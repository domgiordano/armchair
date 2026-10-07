import type { Overview, OverviewEpisode } from "@/lib/api/overview";

/**
 * Aired episodes before `ep` with dances still unanswered, oldest first. An
 * episode whose scoring window closed comes back complete: its unanswered
 * dances are missed, not waiting, so it never holds the next one back.
 */
export function unfinishedBefore(o: Overview, ep: number): OverviewEpisode[] {
  return o.episodes.filter((e) => e.aired && e.ep < ep && !e.complete && (e.answered ?? 0) < (e.rateable ?? 0));
}

/**
 * The `ep` to send /scores/skip-before. Once nothing is left to air, skipping
 * means browsing the whole season, so it runs one past the last episode.
 */
export function skipTarget(o: Overview, ep: number): number {
  return o.next === null ? Math.max(...o.episodes.map((e) => e.ep)) + 1 : ep;
}
