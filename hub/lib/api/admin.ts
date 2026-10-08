import { request, requestWithMeta } from "./client";
import type { Person } from "./social";

// The admin console's endpoints (backend/lambdas/admin_*). Every one is admin-only server-side.

export type AppName = "dwts" | "traitors" | "hub";
export const APP_NAMES: Record<AppName, string> = { dwts: "DWTS", traitors: "Traitors", hub: "Hub" };

export interface Counts {
  dau: number;
  wau: number;
  mau: number;
  devices30: number;
}

export interface Week {
  week: string;
  active: number;
  byApp: Record<AppName, number>;
  signups: number;
  tracked: boolean;
}

export interface Cohort {
  cohort: string;
  size: number;
  /** Share of the cohort active in each week since signup; null before tracking began. */
  weeks: (number | null)[];
}

export interface EpisodeCount {
  ep: number;
  title: string | null;
  users: number;
  answers: number;
  forfeits: number;
}

export interface Overview {
  since: string;
  totals: Counts & { users: number };
  apps: Record<AppName, Counts & { events30: number }>;
  weeks: Week[];
  retention: Cohort[];
  funnel: { visitors: number; signedIn: number; answered: number; signups: number };
  participation: { season: string; app: "dwts" | "traitors"; episodes: EpisodeCount[] }[];
}

export interface UserRow {
  sub: string;
  name: string | null;
  email: string;
  picture: string | null;
  avatarKind: Person["avatarKind"];
  createdAt: string | null;
  lastSeenAt: string | null;
  events: number;
  sessions: number;
  answers: number;
  lastActive: string | null;
  apps: Partial<Record<AppName, number>>;
  groups: number;
}

export interface ActivityEvent {
  at: string;
  sk?: string;
  uid: string;
  sub?: string;
  did: string;
  app: AppName;
  kind: "view" | "action" | "error";
  name: string;
  route: string;
  session: string;
  device: "phone" | "tablet" | "desktop";
  props?: Record<string, string | number | boolean>;
}

export interface AuditEntry {
  sk: string;
  admin: string;
  action: string;
  target: string;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface UserGroup {
  id: string;
  name: string | null;
  owner: boolean | null;
  members: number;
  joinedAt: string | null;
  member: boolean;
  exists: boolean;
}

export interface UserFriend extends Person {
  status: "friend" | "outgoing" | "incoming" | "blocked";
  blocking: boolean;
  blockedBy: boolean;
  at: string | null;
}

export interface UserDetail {
  profile: {
    sub: string;
    email: string;
    name: string | null;
    picture: string | null;
    avatarKind: Person["avatarKind"];
    createdAt: string | null;
    lastSeenAt: string | null;
    customName: string | null;
    googleName: string | null;
    uploadPicture: string | null;
  };
  groups: UserGroup[];
  friends: UserFriend[];
  devices: { did: string; device: string; last: string; events: number }[];
  daily: { day: string; events: number }[];
  audit: AuditEntry[];
  events: ActivityEvent[];
}

const qs = (params: Record<string, string | undefined>) => {
  const set = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return set.length ? `?${new URLSearchParams(set)}` : "";
};

export const getAdminMe = () => request<{ email: string }>("/admin/me");
export const getOverview = () => request<Overview>("/admin/overview");
export const getUsers = (days = 30) => request<UserRow[]>(`/admin/users${qs({ days: String(days) })}`);
export const getUser = (sub: string, before?: string) =>
  requestWithMeta<UserDetail>(`/admin/user${qs({ sub, before })}`);
export const getRecent = (limit = 50) =>
  request<{ events: ActivityEvent[]; people: Record<string, Person> }>(`/admin/events${qs({ limit: String(limit) })}`);
export const getAudit = (before?: string) =>
  requestWithMeta<AuditEntry[]>(`/admin/audit${qs({ before })}`);
