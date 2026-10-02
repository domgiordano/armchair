import { request } from "@armchair/app-core/api/client";
import type { GroupMember } from "@armchair/app-core/api/groups";

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

export interface Leaderboard {
  season: string;
  scope: Scope;
  group: string | null;
  minDances: number;
  ranked: Ranked[];
  unranked: (GroupMember & { count: number })[];
  me: Standing & { rank: number | null };
}

export const ALL_TIME = "all";

export const getLeaderboard = (season: string, scope: Scope, group: string | null) => {
  const query = new URLSearchParams({ season, scope });
  if (group) query.set("group", group);
  return request<Leaderboard>(`/leaderboard/get?${query}`);
};
