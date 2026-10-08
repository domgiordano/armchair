import { request } from "@armchair/app-core/api/client";
import type { GroupMember } from "@armchair/app-core/api/groups";

import { sealedParam } from "@/lib/show/sealed";

export type Scope = "global" | "friends" | "group";

export interface Standing extends GroupMember {
  count: number;
  mae: number | null;
  closestJudge: { id: string; mae: number } | null;
}

export interface Ranked extends Standing {
  rank: number;
  mae: number;
}

/** On a group's current-season board: this week's episode and each member's answers on it. */
export interface GroupWeek {
  ep: number;
  week: number | null;
  rateable: number;
  /** By member sub. */
  answered: Record<string, number>;
}

export interface Leaderboard {
  season: string;
  scope: Scope;
  group: string | null;
  minDances: number;
  ranked: Ranked[];
  unranked: (GroupMember & { count: number })[];
  me: Standing & { rank: number | null };
  week?: GroupWeek;
}

export const ALL_TIME = "all";

export const getLeaderboard = (season: string, scope: Scope, group: string | null) => {
  const query = new URLSearchParams({ season, scope });
  if (group) query.set("group", group);
  const sealed = sealedParam(season);
  if (sealed) query.set("sealed", sealed);
  return request<Leaderboard>(`/leaderboard/get?${query}`);
};
