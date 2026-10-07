import type { ScoreTarget } from "@/lib/show/score-target";

/** The calendar date at `now` in `tz`, as YYYY-MM-DD. */
export function localDate(now: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayAfter = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * The episode to nag about: this week's show while dances are left, on the
 * night it airs and the day after, in the show's time zone. Null otherwise.
 */
export function reminderFor(target: ScoreTarget | null, tz: string, now: number) {
  if (target?.kind !== "score" || target.episode.airDate === null) return null;
  const today = localDate(now, tz);
  const { airDate } = target.episode;
  return today === airDate || today === dayAfter(airDate) ? target : null;
}
