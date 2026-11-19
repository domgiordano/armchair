import type { ScoringWindow } from "@/lib/api/show";
import { showTime } from "@/lib/show/overview";

/** Past its window: read-only, unanswered dances missed. Not the same as not open yet. */
export function isClosed(w: ScoringWindow | undefined, now: number): boolean {
  return w !== undefined && !w.open && w.closesAt !== null && now >= Date.parse(w.closesAt);
}

/**
 * The sealed episodes still taking answers. Once a night closes the next show has
 * started, and a reveal held on it is stale: it holds nothing else back.
 */
export function liveHolds(sealed: number[], episodes: { ep: number; window?: ScoringWindow }[], now: number): number[] {
  return sealed.filter((n) => !isClosed(episodes.find((e) => e.ep === n)?.window, now));
}

/** "6d 4h", "4h 12m", "12m": how long until `closesAt`. */
export function closesIn(closesAt: string, now: number): string {
  const min = Math.max(0, Math.floor((Date.parse(closesAt) - now) / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return min > 0 ? `${m}m` : "under a minute";
}

/** "Tue 8:00 PM ET" in the show's zone. */
export function closesOn(closesAt: string, tz: string): string {
  const day = new Date(closesAt).toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
  return `${day} ${showTime(closesAt, tz)}`;
}
