import { request } from "./client";
import type { Person, Relation } from "./social";

export type GroupMember = Person;

/** Someone listed on a group, with the caller's relation to them; null for the caller. */
export interface GroupPerson extends Person {
  relation: Relation;
  /** Members only. Missing from an API older than the group cards. */
  joinedAt?: string | null;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: GroupMember[];
  /** Missing from an API older than per-group shows. */
  shows?: GroupShow[];
}

export type ShowApp = "dwts" | "traitors";

/** A show the group can play. Membership is shared; each show is switched on per group. */
export interface GroupShow {
  app: ShowApp;
  active: boolean;
  /** Who started it, and when. Null while it's off. */
  by: string | null;
  at: string | null;
  /** Members with anything counted on that show. */
  playing: string[];
}

/** The same /groups/mine rows with everything the management screens need. */
export interface GroupDetail extends Group {
  members: GroupPerson[];
  /** The owner's sub. */
  owner: string;
  /** Whether the invite link files a request for the owner to approve. */
  approval: boolean;
  invited: GroupPerson[];
  /** Join requests; filled for the owner only. */
  requests: GroupPerson[];
}

export const getMyGroups = () => request<Group[]>("/groups/mine");

export const getGroupDetails = () => request<GroupDetail[]>("/groups/mine");

/** `app` is the show it's made in, which it starts out playing; none from the hub. */
export const createGroup = (name: string, app?: ShowApp) =>
  request<Omit<Group, "members">>("/groups/create", { method: "POST", body: JSON.stringify({ name, app }) });

/** Any member starts a show for the group, and the others are told; only the owner stops one. */
export const setGroupShow = (group: string, app: ShowApp, active: boolean) =>
  request<{ app: ShowApp; active: boolean; started: boolean }>("/groups/shows", {
    method: "POST",
    body: JSON.stringify({ group, app, active }),
  });

/**
 * Whether the group plays `app`. A group from an API older than shows has
 * none listed and reads as playing everything, as it did before.
 */
export const plays = (group: { shows?: GroupShow[] }, app: ShowApp) =>
  group.shows?.find((s) => s.app === app)?.active ?? true;

export const joinGroup = (code: string) =>
  request<Pick<Group, "id" | "name"> & { pending: boolean }>("/groups/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

const post = <T>(path: string, body: object) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const inviteToGroup = (group: string, sub: string) =>
  post<{ status: "invited" | "member" }>("/groups/invite", { group, sub });

export const respondToInvite = (group: string, accept: boolean) =>
  post<{ id: string; name: string; member: boolean }>("/groups/respond", { group, accept });

export type GroupAction =
  | { action: "rename"; name: string }
  | { action: "remove" | "approve" | "deny"; sub: string }
  | { action: "approval"; approval: boolean };

/** Owner only; anyone else gets a 403. */
export const manageGroup = (group: string, change: GroupAction) =>
  post<{ ok: true }>("/groups/manage", { group, ...change });

export const deleteGroup = (group: string) => post<{ ok: true }>("/groups/delete", { group });

export const leaveGroup = (group: string) => post<{ ok: true }>("/groups/leave", { group });

export const groupHref = (id: string) => `/groups/?id=${encodeURIComponent(id)}`;

// The API page names the group in the link preview, which the static /join/
// can't, then redirects to /join/?code= on the site that made the link
// (backend/lambdas/invite_preview), so a Traitors invite opens in Traitors.
export const inviteLink = (code: string) =>
  `${process.env.NEXT_PUBLIC_API_URL}/invite/preview?${new URLSearchParams({ code, site: window.location.origin })}`;
