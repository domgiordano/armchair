import { request } from "./client";
import type { Person } from "./social";

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: Person[];
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
