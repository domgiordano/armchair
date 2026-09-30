export const SMS_NUMBER = "21523";
export const VOTE_URL = "https://dwtsvote.abc.com";
export const MAX_VOTES = 10;

export interface AirEpisode {
  ep: number;
  airDate: string;
  start: string;
  end: string;
}

export type VoteWindow = { open: true; episode: AirEpisode } | { open: false; next: AirEpisode | null };

function wallClock(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * Whether ABC's vote is open at `now`. It runs only during the live Eastern
 * broadcast, so this compares the air zone's wall clock, never the device's:
 * a Pacific viewer watching at 8 pm local has missed it.
 */
export function voteWindow(episodes: AirEpisode[], timeZone: string, now: Date): VoteWindow {
  const { date, time } = wallClock(now, timeZone);
  const live = episodes.find((e) => e.airDate === date && e.start <= time && time < e.end);
  if (live) return { open: true, episode: live };
  const next = episodes.find((e) => e.airDate > date || (e.airDate === date && time < e.start));
  return { open: false, next: next ?? null };
}

/** "Tue, Oct 13 at 8:00 pm", read straight from the catalog's air-zone strings. */
export function airTime(episode: AirEpisode): string {
  const [y, m, d] = episode.airDate.split("-").map(Number);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const [h, min] = episode.start.split(":").map(Number);
  return `${day} at ${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/**
 * Messages on iOS and macOS reads the body after "&", Android after "?". iPadOS
 * reports itself as Macintosh.
 */
export function smsHref(keyword: string, userAgent: string): string {
  const sep = /iPhone|iPad|iPod|Macintosh/.test(userAgent) ? "&" : "?";
  return `sms:${SMS_NUMBER}${sep}body=${encodeURIComponent(keyword)}`;
}

const votesKey = (ep: number) => `armchair:votes:${ep}`;

// Storage throws in some private modes and when full. The counter is a local
// tally only, so it falls back to living in memory for the visit.
export function readVotes(ep: number): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(votesKey(ep)) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function writeVotes(ep: number, votes: Record<string, number>): void {
  try {
    localStorage.setItem(votesKey(ep), JSON.stringify(votes));
  } catch {
    // See readVotes.
  }
}
