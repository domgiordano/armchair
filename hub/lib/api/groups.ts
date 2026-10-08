import type { GroupShow, ShowApp } from "@armchair/app-core/api/groups";

import { request, requestWithMeta } from "./client";
import type { Person } from "./social";

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: (Person & { joinedAt?: string | null })[];
  /** Missing from an API older than per-group shows. */
  shows?: GroupShow[];
}

export const getMyGroups = () => request<Group[]>("/groups/mine");

export const createGroup = (name: string) =>
  request<Omit<Group, "members">>("/groups/create", { method: "POST", body: JSON.stringify({ name }) });

export const respondToInvite = (group: string, accept: boolean) =>
  request<{ id: string; name: string; member: boolean }>("/groups/respond", {
    method: "POST",
    body: JSON.stringify({ group, accept }),
  });

export const manageGroup = (group: string, change: { action: "approve" | "deny"; sub: string }) =>
  request<{ ok: true }>("/groups/manage", { method: "POST", body: JSON.stringify({ group, ...change }) });

/** Any member starts a show for the group, and the others are told. */
export const setGroupShow = (group: string, app: ShowApp, active: boolean) =>
  request<{ app: ShowApp; active: boolean; started: boolean }>("/groups/shows", {
    method: "POST",
    body: JSON.stringify({ group, app, active }),
  });

export interface GroupBoardSummary {
  leader: string | null;
  rank: number | null;
  /** DWTS only: members who scored the whole of this week's show, of how many dances. */
  week: { week: number | null; done: number } | null;
}

interface Standing {
  sub: string;
  name: string | null;
}

/** The group's current DWTS season board, cut down to what a card shows. */
export async function dwtsGroupBoard(season: string, group: string): Promise<GroupBoardSummary> {
  const query = new URLSearchParams({ season, scope: "group", group });
  const { data } = await requestWithMeta<{
    ranked: (Standing & { rank: number })[];
    me: { rank: number | null };
    week?: { week: number | null; rateable: number; answered: Record<string, number> };
  }>(`/leaderboard/get?${query}`);
  const week = data.week;
  return {
    leader: data.ranked[0]?.name ?? null,
    rank: data.me.rank,
    week: week ? { week: week.week, done: Object.values(week.answered).filter((n) => n >= week.rateable && n > 0).length } : null,
  };
}

/** The group's all-time Traitors board on one edition. */
export async function traitorsGroupBoard(show: string, group: string): Promise<GroupBoardSummary> {
  const query = new URLSearchParams({ season: "all", show, scope: "group", group });
  const { data } = await requestWithMeta<{ ranked: (Standing & { rank: number })[]; me: { rank: number | null } }>(
    `/traitors/ranks?${query}`,
  );
  return { leader: data.ranked[0]?.name ?? null, rank: data.me.rank, week: null };
}
