import { request } from "./client";
import type { Answer, Headshot, JudgeSeat } from "./show";
import type { Match } from "./social";

export type Role = "celebrity" | "pro" | "judge";

/** A star, pro or judge from the cross-season index. */
export interface PersonHit {
  id: string;
  name: string;
  /** Most recent role first. */
  roles: Role[];
  /** A Commons file under /headshots/, or null. */
  headshot: string | null;
  seasons: number[];
}

export interface SearchResults {
  users: Match[];
  stars: PersonHit[];
  pros: PersonHit[];
  judges: PersonHit[];
}

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 40;

export const profileHref = (sub: string) => `/profile/?u=${encodeURIComponent(sub)}`;

export interface Dancer {
  id: string;
  name: string;
  role: "celebrity" | "pro";
}

export interface Average {
  count: number;
  mean: number | null;
}

interface RowBase {
  season: string;
  ep: number;
  week: number | null;
  key: string;
  style: string | null;
  song: string | null;
  dancers: Dancer[];
}

/** A dance the caller hasn't answered: what the pre-show table says, and nothing else. */
export interface LockedRow extends RowBase {
  locked: true;
}

export interface OpenRow extends RowBase {
  locked: false;
  judges: JudgeSeat[];
  /** Null until every panel judge is confirmed. */
  panelMean: number | null;
  mine: Answer | null;
  friends: Average;
  everyone: Average;
}

export type PerformanceRow = LockedRow | OpenRow;

export type SeasonResult =
  | { locked: true; season: string; ep: number }
  | { status: "out"; ep: number; week: number | null }
  | { status: "dancing" }
  | { status: "finalist" };

export interface Stint {
  season: string;
  number: number;
  role: Role;
  /** False for a past season the caller hasn't scored: no rows, no result, until asked for. */
  loaded: boolean;
  partners?: { id: string; name: string }[];
  result?: SeasonResult | null;
  dances?: number;
  locked?: number;
}

export interface DancerStats {
  dances: number;
  locked: number;
  judges: Average;
  best: { season: string; ep: number; week: number | null; style: string | null; panelMean: number } | null;
  mine: { count: number; mean: number | null; gap: number | null };
  friends: Average;
  everyone: Average;
}

export interface Extreme {
  season: string;
  ep: number;
  week: number | null;
  style: string | null;
  dancers: Dancer[];
  value: number;
  vsPanel: number;
}

export interface JudgeStats {
  dances: number;
  locked: number;
  count: number;
  mean: number | null;
  panelMean: number | null;
  /** Their score minus the rest of the panel's, on average: below zero is harsher. */
  vsPanel: number | null;
  harshest: Extreme[];
  generous: Extreme[];
  byStyle: { style: string; count: number; mean: number | null }[];
  bySeason: { season: string; count: number; mean: number | null }[];
  distribution: Record<string, number>;
  mine: { count: number; gap: number | null; mae: number | null };
}

export interface PersonPage {
  id: string;
  name: string;
  roles: Role[];
  headshot: Headshot | null;
  bio: { title: string; url: string; description: string | null; extract: string } | null;
  facts: { born: string | null; died: string | null; occupations: string[]; nationality: string[] } | null;
  seasons: Stint[];
  performances: PerformanceRow[];
  judged: { season: string; rows: PerformanceRow[] } | null;
  stats: { dancer: DancerStats | null; judge: JudgeStats | null };
}

export const getPerson = (id: string, season?: string) => {
  const query = new URLSearchParams({ id });
  if (season) query.set("season", season);
  return request<PersonPage>(`/people/get?${query}`);
};
