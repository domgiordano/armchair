import { request } from "@armchair/app-core/api/client";

import type { GroupMember } from "@armchair/app-core/api/groups";

import { sealedParam } from "@/lib/show/sealed";
import type { Elimination } from "./couples";

/** Mean error and bias over some calls; shares are 0-1. Bias is paddle minus the panel mean. */
export interface Summary {
  count: number;
  mae: number | null;
  bias: number | null;
  /** Share of calls on the panel mean, rounded half up. */
  exact: number | null;
  /** Share of calls within a point of it. */
  close: number | null;
}

/** A summary beside the means it compares: the paddle's and the judges'. */
export interface Versus extends Summary {
  paddle: number | null;
  judges: number | null;
}

/** One paddle on one dance with every judge confirmed. */
export interface Call {
  ep: number;
  week: number | null;
  key: string;
  style: string | null;
  couples: string[];
  paddle: number;
  /** The panel mean. */
  judges: number;
  panel: Record<string, number>;
  gap: number;
  error: number;
}

export interface StatsEpisode {
  ep: number;
  week: number | null;
  theme: string | null;
  /** Dances this episode shows you, judges confirmed. */
  dances: number;
}

export interface PersonStats extends Versus {
  season: string;
  ep: number | null;
  person: { sub: string; name?: string | null; picture?: string | null; avatarKind?: string | null };
  episodes: StatsEpisode[];
  sub: string;
  rank: number | null;
  ranked: number;
  weeks: (Versus & { ep: number; week: number | null; theme: string | null; rank: number | null; ranked: number })[];
  byJudge: { id: string; count: number; mae: number; bias: number }[];
  styles: (Versus & { style: string })[];
  couples: (Versus & { id: string })[];
  favorites: string[];
  leastFavorites: string[];
  styleLikes: string[];
  styleDislikes: string[];
  streak: { current: number; best: number };
  best: Call[];
  worst: Call[];
  distribution: { score: number; you: number; judges: number }[];
  calls: Call[];
  eliminated: Record<string, Elimination>;
}

/** Paddles over some dances. Null below two raters besides you. */
export interface CrowdNumbers {
  raters: number;
  crowd: number | null;
  spread: number | null;
  /** Crowd minus judges. */
  delta: number | null;
}

export interface Standing extends Summary {
  sub: string;
  rank: number | null;
}

export interface CrowdWeek extends Summary {
  ep: number;
  week: number | null;
  theme: string | null;
  dances: number;
  participants: number;
  /** That week's top three. */
  leaders: (Summary & { sub: string; rank: number })[];
  /** Standings over the season through this week: everyone in a group, the top three and you otherwise. */
  standings: Standing[];
}

export interface CrowdDance extends CrowdNumbers {
  ep: number;
  week: number | null;
  key: string;
  style: string | null;
  couples: string[];
  judges: number;
}

export interface CoupleWeek extends CrowdNumbers {
  ep: number;
  week: number | null;
  dances: number;
  judges: number | null;
}

/** "Couple votes": how the scope scored one couple, week by week, beside the judges. */
export interface CoupleVotes extends CrowdNumbers {
  id: string;
  dances: number;
  judges: number | null;
  weeks: CoupleWeek[];
}

export interface MemberCard extends Summary {
  sub: string;
  rank: number | null;
  /** The style they score furthest above the judges. */
  favoriteStyle: string | null;
  /** The style they call closest. */
  bestStyle: string | null;
  favorite: string | null;
  leastFavorite: string | null;
}

export type CrowdScope = "global" | "friends" | "group";

export interface CrowdStats extends Summary {
  season: string;
  ep: number | null;
  scope: CrowdScope;
  group: string | null;
  episodes: StatsEpisode[];
  people: Record<string, GroupMember>;
  raters: number;
  weeks: CrowdWeek[];
  dances: CrowdDance[];
  divisive: { ep: number; key: string }[];
  couples: CoupleVotes[];
  favorites: string[];
  leastFavorites: string[];
  styles: (CrowdNumbers & { style: string; dances: number; judges: number | null })[];
  /** Friends and group scopes only. */
  members?: MemberCard[];
  /** [wins, losses, ties] of the first sub against the second, over dances both scored. */
  headToHead?: Record<string, Record<string, [number, number, number]>>;
  global?: Summary & { weeks: (Summary & { ep: number })[] };
  eliminated: Record<string, Elimination>;
}

function statsQuery(season: string, params: Record<string, string | number | null | undefined>): URLSearchParams {
  const query = new URLSearchParams({ season });
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) query.set(k, String(v));
  const sealed = sealedParam(season);
  if (sealed) query.set("sealed", sealed);
  return query;
}

/** One person's breakdown: yours without `sub`. `ep` narrows it to one episode. */
export const getPersonStats = (season: string, sub: string | null = null, ep: number | null = null) =>
  request<PersonStats>(`/stats/me?${statsQuery(season, { sub, ep: ep === null ? null : String(ep).padStart(2, "0") })}`);

export const getCrowdStats = (season: string, scope: CrowdScope, group: string | null = null, ep: number | null = null) =>
  request<CrowdStats>(
    `/stats/crowd?${statsQuery(season, { scope, group, ep: ep === null ? null : String(ep).padStart(2, "0") })}`,
  );
