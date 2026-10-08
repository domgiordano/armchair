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

export interface Answer {
  value?: number;
  forfeit?: boolean;
  picks?: string[];
  submittedAt?: string;
  adminBy?: string;
}

export interface Answers {
  season: string;
  ep: number;
  app: "dwts" | "traitors";
  state: "live" | "closed" | "upcoming";
  slots: { key: string; label: string; picks?: number; answer: Answer | null }[];
  roster?: { id: string; name: string }[];
}

export const SCREENS = [
  "overview",
  "profile",
  "episode",
  "stats",
  "groups",
  "notifications",
  "leaderboard",
  "week_board",
  "performers",
  "traitors_season",
  "traitors_episode",
  "traitors_stats",
] as const;
export type Screen = (typeof SCREENS)[number];

export interface ViewAs {
  screen: Screen;
  status: number;
  data: unknown;
  error: { message: string } | null;
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

const post = <T>(path: string, body: Record<string, unknown>) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const getAnswers = (sub: string, season: string, ep: string) =>
  request<Answers>(`/admin/answers${qs({ sub, season, ep })}`);
export const viewAs = (sub: string, screen: Screen, params: Record<string, string>) =>
  request<ViewAs>(`/admin/view${qs({ as: sub, screen, ...params })}`);

export const setProfile = (sub: string, reason: string, change: { name?: string | null; resetAvatar?: true }) =>
  post<UserDetail["profile"]>("/admin/profile", { sub, reason, ...change });
export const setMembership = (sub: string, group: string, action: "add" | "remove" | "repair" | "resend", reason: string) =>
  post<{ member: boolean; linked: boolean; invited: boolean }>("/admin/membership", { sub, group, action, reason });
export const setFriendship = (a: string, b: string, action: "unblock" | "unlink", reason: string) =>
  post<{ a: string | null; b: string | null }>("/admin/friendship", { a, b, action, reason });
export const setAnswer = (body: Record<string, unknown>) => post<{ answer: Answer | null }>("/admin/answer", body);
export const deleteUser = (sub: string, reason: string, confirm: string) =>
  post<{ deleted: string }>("/admin/delete", { sub, reason, confirm });
