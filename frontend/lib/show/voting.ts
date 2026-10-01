import type { Episode } from "@/lib/api/show";
import { zonedInstant } from "./schedule";

export const SMS_NUMBER = "21523";
export const VOTE_URL = "https://dwtsvote.abc.com";
export const MAX_VOTES = 10;

export type VotePhase = "before" | "open" | "closed";

/**
 * Where ABC's vote stands on the episode's air date, or null on any other day.
 * It runs only during the live Eastern broadcast, start to the catalog's end
 * time, so a Pacific viewer watching at 8 pm local finds it closed.
 */
export function votePhase(e: Episode, tz: string, now: number): VotePhase | null {
  if (e.airDate === null || e.start === null || e.end === null) return null;
  const dayStart = zonedInstant(e.airDate, "00:00", tz);
  const dayEnd = zonedInstant(e.airDate, "23:59", tz) + 60_000;
  if (now < dayStart || now >= dayEnd) return null;
  if (now < zonedInstant(e.airDate, e.start, tz)) return "before";
  return now < zonedInstant(e.airDate, e.end, tz) ? "open" : "closed";
}

/** "8:00 pm" from the catalog's "20:00". */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
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

// Storage throws in some private modes and when full. The tally is local only,
// so it falls back to living in memory for the visit.
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
