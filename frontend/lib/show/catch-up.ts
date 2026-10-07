import type { Overview, OverviewEpisode } from "@/lib/api/overview";

/**
 * Aired episodes before `ep` with dances still unanswered, oldest first. An
 * episode whose scoring window closed comes back complete: its unanswered
 * dances are missed, not waiting, so it never holds the next one back.
 */
export function unfinishedBefore(o: Overview, ep: number): OverviewEpisode[] {
  return o.episodes.filter((e) => e.aired && e.ep < ep && !e.complete && (e.answered ?? 0) < (e.rateable ?? 0));
}
