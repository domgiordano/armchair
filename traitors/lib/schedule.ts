import type { SeasonEpisode } from "@/lib/api/traitors";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const released = (e: Pick<SeasonEpisode, "releaseAt">, now: number) => Date.parse(e.releaseAt) <= now;

/** Every call made, or nothing to call: its results are yours to see. */
export const unlocked = (e: SeasonEpisode) => e.closed || e.answered >= e.events;

export const episodeLabel = (e: Pick<SeasonEpisode, "ep" | "title">) => e.title ?? `Episode ${e.ep}`;

/** "Thu, Oct 15, 9:00 PM" in the viewer's own zone. */
export function formatRelease(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2d 4h", "3h 12m", "12m", "now". */
export function countdown(ms: number): string {
  if (ms < MIN) return "now";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const nextRelease = (episodes: SeasonEpisode[], now: number) => episodes.find((e) => !released(e, now)) ?? null;

/** Released episodes you can still pick and haven't finished, oldest first. */
export const toCall = (episodes: SeasonEpisode[], now: number) =>
  episodes.filter((e) => released(e, now) && !unlocked(e));

/**
 * Earlier open episodes you haven't finished. Episode N's roster gives away who
 * left before it, so opening N skips their surprise.
 */
export const unfinishedBefore = (episodes: SeasonEpisode[], ep: number, now: number) =>
  toCall(episodes, now).filter((e) => e.ep < ep);

/** The newest released episode whose results you may see. */
export const latestUnlocked = (episodes: SeasonEpisode[], now: number) =>
  episodes.filter((e) => released(e, now) && unlocked(e)).at(-1) ?? null;

/** The episode to open when none is asked for: the oldest still to call, else the newest out. */
export function defaultEpisode(episodes: SeasonEpisode[], now: number): SeasonEpisode | null {
  return toCall(episodes, now)[0] ?? episodes.filter((e) => released(e, now)).at(-1) ?? episodes[0] ?? null;
}

/** Poll fast from an hour before a release until six after, when results confirm. */
export const isLive = (releaseAt: string, now: number) => {
  const t = Date.parse(releaseAt);
  return now >= t - HOUR && now <= t + 6 * HOUR;
};
