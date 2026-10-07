import type { Overview, OverviewEpisode } from "@/lib/api/overview";
import { LIVE_TAIL_MS } from "@/lib/show/schedule";

export type ScoreTarget =
  /** Aired and not finished. Counts are null when it aired after the overview was fetched. */
  | { kind: "score"; episode: OverviewEpisode; live: boolean; answered: number | null; rateable: number | null }
  | { kind: "done"; episode: OverviewEpisode; next: Overview["next"] }
  | { kind: "upcoming"; next: NonNullable<Overview["next"]> };

const started = (e: OverviewEpisode, now: number) => (e.startsAt === null ? e.aired : Date.parse(e.startsAt) <= now);

/**
 * This week's show: the latest episode to have started, which every "score the
 * show" call to action points at. Null for a past season, where nothing takes a paddle.
 */
export function scoreTarget(o: Overview, now: number): ScoreTarget | null {
  if (o.open) return null;
  const episode = o.episodes.findLast((e) => started(e, now));
  if (!episode) return o.next ? { kind: "upcoming", next: o.next } : null;
  if (episode.complete) return { kind: "done", episode, next: o.next };
  return {
    kind: "score",
    episode,
    live: episode.endsAt !== null && now < Date.parse(episode.endsAt) + LIVE_TAIL_MS,
    answered: episode.answered ?? null,
    rateable: episode.rateable ?? null,
  };
}
