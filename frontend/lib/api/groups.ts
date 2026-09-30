import { request } from "./client";

export interface GroupMember {
  sub: string;
  name: string | null;
  picture: string | null;
  avatarKind: "google" | "initials" | null;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: GroupMember[];
}

export const getMyGroups = () => request<Group[]>("/groups/mine");

export const createGroup = (name: string) =>
  request<Omit<Group, "members">>("/groups/create", { method: "POST", body: JSON.stringify({ name }) });

export const joinGroup = (code: string) =>
  request<Pick<Group, "id" | "name">>("/groups/join", { method: "POST", body: JSON.stringify({ code }) });

export const inviteLink = (code: string) =>
  `${window.location.origin}/join/?code=${encodeURIComponent(code)}`;
