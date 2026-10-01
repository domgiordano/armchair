import type { Overview, OverviewEpisode } from "@/lib/api/overview";
import { LIVE_TAIL_MS } from "@/lib/show/schedule";

export type Hero =
  | { kind: "live"; episode: OverviewEpisode }
  | { kind: "catchUp"; episode: OverviewEpisode; waiting: number; fresh: boolean }
  | { kind: "upNext" }
  | { kind: "wrap" };

/**
 * What the Overview hero pushes: the episode on air, else the oldest aired one
 * left unfinished, else the countdown. Times are checked against `now` rather
 * than the fetch's `aired` flag, so the hero turns live at showtime without a reload.
 */
export function hero(o: Overview, now: number): Hero {
  // A past season's episodes have no times, only `aired`.
  const started = o.episodes.filter((e) => (e.startsAt === null ? e.aired : Date.parse(e.startsAt) <= now));
  const live = started.find((e) => e.endsAt !== null && now < Date.parse(e.endsAt) + LIVE_TAIL_MS && !e.complete);
  if (live) return { kind: "live", episode: live };
  const open = started.filter((e) => !e.complete);
  if (open.length > 0) {
    return { kind: "catchUp", episode: open[0], waiting: open.length, fresh: o.me.scored === 0 };
  }
  return started.length === o.episodes.length ? { kind: "wrap" } : { kind: "upNext" };
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdown(ms: number): Countdown {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** "8:00 PM ET" in the show's zone. */
export function showTime(iso: string, tz: string): string {
  const time = new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  return tz === "America/New_York" ? `${time} ET` : time;
}

/** "W5", or "W1.2" for a second night in the same week. */
export function shortLabel(e: OverviewEpisode, episodes: OverviewEpisode[]): string {
  const nights = episodes.filter((o) => o.week === e.week);
  return nights.length < 2 ? `W${e.week}` : `W${e.week}.${nights.indexOf(e) + 1}`;
}
