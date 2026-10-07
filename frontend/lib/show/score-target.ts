import type { Overview, OverviewEpisode } from "@/lib/api/overview";
import { LIVE_TAIL_MS } from "@/lib/show/schedule";

export type ScoreTarget =
  /** Taking answers and not finished. Counts are null when it aired after the overview was fetched. */
  | {
      kind: "score";
      episode: OverviewEpisode;
      live: boolean;
      answered: number | null;
      rateable: number | null;
      /** When answers stop; null from an API older than scoring windows. */
      closesAt: string | null;
    }
  | { kind: "done"; episode: OverviewEpisode; next: Overview["next"] }
  | { kind: "upcoming"; next: NonNullable<Overview["next"]> };

const started = (e: OverviewEpisode, now: number) => (e.startsAt === null ? e.aired : Date.parse(e.startsAt) <= now);
const live = (e: OverviewEpisode, now: number) => e.endsAt !== null && now < Date.parse(e.endsAt) + LIVE_TAIL_MS;

/**
 * This week's show, which every "score the show" call to action points at: the
 * server's activeEpisode when it sends one, else the latest episode to have
 * started. Null for a past season, where nothing takes a paddle.
 */
export function scoreTarget(o: Overview, now: number): ScoreTarget | null {
  if (o.open) return null;
  const active = o.activeEpisode;
  const fallback = o.episodes.findLast((e) => started(e, now));
  const episode = active ? (o.episodes.find((e) => e.ep === active.ep) ?? fallback) : fallback;
  if (!episode) return o.next ? { kind: "upcoming", next: o.next } : null;

  if (active && active.ep === episode.ep) {
    if (active.rateable > 0 && active.answered >= active.rateable) return { kind: "done", episode, next: o.next };
    const { answered, rateable, closesAt } = active;
    return { kind: "score", episode, live: live(episode, now), answered, rateable, closesAt };
  }
  // With windows, nothing taking answers means the latest episode closed: point at the next show, if any.
  if (active === null && !episode.complete) return o.next ? { kind: "upcoming", next: o.next } : null;
  if (episode.complete) return { kind: "done", episode, next: o.next };
  return {
    kind: "score",
    episode,
    live: live(episode, now),
    answered: episode.answered ?? null,
    rateable: episode.rateable ?? null,
    closesAt: episode.window?.closesAt ?? null,
  };
}
