import { request, requestWithMeta } from "./client";

/** What anyone may see of another user: never their email. */
export interface Person {
  sub: string;
  name: string | null;
  picture: string | null;
  avatarKind: "google" | "initials" | "upload" | null;
}

export type Relation = "friend" | "outgoing" | "incoming" | "blocked" | null;

export interface Contact extends Person {
  at: string | null;
}

export interface Friends {
  inviteCode: string;
  friends: Contact[];
  incoming: Contact[];
  outgoing: Contact[];
  blocked: Contact[];
}

export interface Match extends Person {
  status: Exclude<Relation, "blocked">;
}

const post = <T>(path: string, body: object) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const getFriends = () => request<Friends>("/friends/list");

export const searchPeople = (q: string) =>
  request<Match[]>(`/friends/search?q=${encodeURIComponent(q)}`);

export const addFriend = (target: { sub: string } | { code: string }) =>
  post<{ status: Relation; user: Person }>("/friends/request", target);

export const acceptFriend = (sub: string) => post<{ status: Relation }>("/friends/accept", { sub });

/** Unfriend, cancel your request, or decline theirs: the server works out which. */
export const removeFriend = (sub: string) => post<{ status: Relation }>("/friends/remove", { sub });

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "group_invite"
  | "group_join_request"
  | "group_join_accepted";

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  state: "pending" | "accepted" | "declined" | null;
  at: string;
  from: Person;
  group: { id: string; name: string | null } | null;
}

export interface NotificationPage {
  items: Notification[];
  unread: number;
  next: string | null;
}

export async function getNotifications(limit = 50): Promise<NotificationPage> {
  const { data, meta } = await requestWithMeta<Notification[]>(`/notifications/list?limit=${limit}`);
  return {
    items: data,
    unread: typeof meta?.unread === "number" ? meta.unread : 0,
    next: typeof meta?.next === "string" ? meta.next : null,
  };
}

export const markNotificationsRead = (id?: string) =>
  post<unknown>("/notifications/read", id ? { id } : { all: true });
