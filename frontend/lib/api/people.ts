import { request } from "@armchair/app-core/api/client";

import { sealPerson } from "@/lib/show/seal-views";
import { currentSeals } from "@/lib/show/sealed";
import type { Answer, Headshot, JudgeSeat, LockedWriteup, Writeup } from "./show";
import type { Match } from "@armchair/app-core/api/social";

export type Role = "celebrity" | "pro" | "judge";

/** A star, pro or judge from the cross-season index. */
export interface PersonHit {
  id: string;
  name: string;
  /** Most recent role first. */
  roles: Role[];
  /** Our crop under /headshots/, or null. */
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
  /** Answered, but you haven't revealed the judges yet (lib/show/seal-views.ts). */
  sealed?: true;
  writeup?: LockedWriteup | null;
}

export interface OpenRow extends RowBase {
  locked: false;
  writeup?: Writeup | null;
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

export interface Partner {
  id: string;
  name: string;
  /** Missing until the person index is re-seeded. */
  headshot?: Headshot | null;
}

export interface Stint {
  season: string;
  number: number;
  role: Role;
  /** False for a past season the caller hasn't scored: no rows, no result, until asked for. */
  loaded: boolean;
  partners?: Partner[];
  result?: SeasonResult | null;
  /** The couple's finish, of `cast` couples. Only a finished season has one. */
  place?: number;
  cast?: number;
  dances?: number;
  locked?: number;
  /** A judge's stint: off that season's regular panel, and the weeks they sat in. */
  guest?: boolean;
  weeks?: number[];
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

/** The couple a judge scored highest in a season, over dances the caller has answered. */
export interface TopCouple {
  dancers: Dancer[];
  mean: number | null;
  count: number;
}

export type SimilarReason = "category" | "cast" | "finish";

/** Another celebrity like this one: the same field, the same cast, or a finish in the same part of the field. */
export interface SimilarCelebrity {
  id: string;
  name: string;
  headshot: Headshot | null;
  /** Their latest season's number. */
  season: number;
  category: string | null;
  reasons: SimilarReason[];
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
  bySeason: { season: string; count: number; mean: number | null; top?: TopCouple | null }[];
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
  /** A celebrity's field of work, from their bio. */
  category?: string | null;
  similar?: SimilarCelebrity[] | null;
  seasons: Stint[];
  performances: PerformanceRow[];
  judged: { season: string; rows: PerformanceRow[] } | null;
  stats: { dancer: DancerStats | null; judge: JudgeStats | null };
}

export const getPerson = (id: string, season?: string) => {
  const query = new URLSearchParams({ id });
  if (season) query.set("season", season);
  return request<PersonPage>(`/people/get?${query}`).then((p) => sealPerson(p, currentSeals()));
};

/** Who someone is and every season they danced, with no dances read: cheap enough to fetch beside another page. */
export const getPersonBrief = (id: string) => request<PersonPage>(`/people/get?${new URLSearchParams({ id, brief: "1" })}`);
