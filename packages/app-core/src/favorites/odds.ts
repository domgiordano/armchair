import { request } from "../api/client";

/** GET /favorites/get: odds to win as of the last episode the caller has revealed. */
export interface OddsEntry<H> {
  id: string;
  rank: number;
  // Null only when nothing prices the board yet.
  chance: number | null;
  odds: string | null;
  model: number | null;
  market: number | null;
  inputs: Record<string, number | null>;
  why: string[];
  move: { rank: number; chance: number } | null;
  name: string | null;
  partner: string | null;
  headshot: H;
}

export interface OddsBoard<H> {
  season: string;
  show: string;
  revealed: number;
  asOf: number | null;
  latest: number;
  behind: boolean;
  computedAt?: string;
  source?: "market" | "model";
  model: string;
  market: { source: string; url: string; capturedAt: string } | null;
  episodes?: { ep: number; week: number | null }[];
  entries: OddsEntry<H>[];
}

export const getOdds = <H>(season: string, through?: number) =>
  request<OddsBoard<H>>(
    `/favorites/get?season=${encodeURIComponent(season)}${through === undefined ? "" : `&through=${through}`}`,
  );

/** "22%", or "<1%" for a long shot, so nobody reads 0% as out. */
export function percent(chance: number): string {
  if (chance < 0.01) return "<1%";
  return `${Math.round(chance * 100)}%`;
}

export type Trend = "up" | "down" | "flat";

/** Which way a contestant moved since the last snapshot: by place, then by a point of chance. */
export function trend(move: OddsEntry<unknown>["move"]): Trend | null {
  if (!move) return null;
  if (move.rank > 0 || (move.rank === 0 && move.chance >= 0.01)) return "up";
  if (move.rank < 0 || (move.rank === 0 && move.chance <= -0.01)) return "down";
  return "flat";
}

export function moveLabel(move: OddsEntry<unknown>["move"]): string | null {
  const t = trend(move);
  if (!move || !t) return null;
  if (t === "flat") return "No change";
  const pts = Math.round(Math.abs(move.chance) * 100);
  const places = Math.abs(move.rank);
  const dir = t === "up" ? "Up" : "Down";
  if (places) return `${dir} ${places} ${places === 1 ? "place" : "places"}`;
  return `${dir} ${pts} ${pts === 1 ? "point" : "points"}`;
}

/** "Odds via Polymarket as of Oct 6, 3:00 PM" or "Armchair odds (model)". */
export function sourceLabel(board: Pick<OddsBoard<unknown>, "market">, timeZone?: string): string {
  if (!board.market) return "Armchair odds (model)";
  const at = new Date(board.market.capturedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return `Odds via ${board.market.source} as of ${at}`;
}
