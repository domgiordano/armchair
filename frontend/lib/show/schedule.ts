import type { Episode } from "@/lib/api/show";

// Judges' scores reach Wikipedia 5-12 minutes after each dance and confirm 3
// minutes later (PLAN.md), so the last couples' scores land after the credits.
export const LIVE_TAIL_MS = 30 * 60 * 1000;

/** How far `tz` is ahead of UTC at instant `t`, in ms. */
function offset(t: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(t)
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - t;
}

/** The instant a wall-clock time in `tz` names, e.g. 20:00 in New York on 2026-10-13. */
export function zonedInstant(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  const first = wall - offset(wall, tz);
  // A guess on the far side of a DST change lands one hour out; the second pass fixes it.
  return wall - offset(first, tz);
}

/** An episode with no time is a past season's, so it has aired. */
export function hasAired(e: Episode, tz: string, now: number): boolean {
  if (e.airDate === null || e.start === null) return true;
  return now >= zonedInstant(e.airDate, e.start, tz);
}

export function isLive(e: Episode, tz: string, now: number): boolean {
  if (e.airDate === null || e.end === null) return false;
  return hasAired(e, tz, now) && now < zonedInstant(e.airDate, e.end, tz) + LIVE_TAIL_MS;
}

/** The latest episode whose start has passed, or the first one before the season starts. */
export function latestAired(episodes: Episode[], tz: string, now: number): Episode {
  return episodes.findLast((e) => hasAired(e, tz, now)) ?? episodes[0];
}

/** "Tue, Oct 13". The date is already the show's local date, so no zone shift applies. */
export function formatAirDate(date: string | null): string | null {
  if (date === null) return null;
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Week 4", or "Week 1, night 2" when two episodes share a week. */
export function episodeLabel(e: Episode, episodes: Episode[]): string {
  const nights = episodes.filter((o) => o.week === e.week);
  if (nights.length < 2) return `Week ${e.week}`;
  return `Week ${e.week}, night ${nights.indexOf(e) + 1}`;
}
