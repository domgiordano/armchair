import { ApiError, request, type AvatarKind, type Me } from "@armchair/app-core/api/client";
import { sealProfile } from "@/lib/show/seal-views";
import { currentSeals } from "@/lib/show/sealed";
import type { Member } from "./show";
import type { Person } from "@armchair/app-core/api/social";

/** /users/me as its owner sees it: the effective name and photo plus what they can switch to. */
export interface MyProfile extends Me {
  customName: string | null;
  googleName: string | null;
  googlePicture: string | null;
  uploadPicture: string | null;
}

/** A leaderboard place: null below the five-dance floor; `ranked` is how many have one. */
export interface Place {
  rank: number | null;
  ranked: number;
}

export interface SeasonSummary extends Place {
  /** A season id, or "all". */
  season: string;
  count: number;
  // Null until there is something to compare, and for someone else below five dances.
  mae: number | null;
  judges: Record<string, { count: number; mae: number }>;
}

/** The leaderboard's all-time row; someone else's error stays null below five dances. */
export interface AllTime extends Place {
  count: number;
  mae: number | null;
  closestJudge: { id: string; mae: number } | null;
}

/** One episode the profile's owner answered something in: counts only. */
export interface Activity {
  season: string;
  ep: number;
  week: number | null;
  theme: string | null;
  airDate: string | null;
  answered: number;
  scored: number;
}

/** Means over a set of dances: the gap to the judges, the paddle and the judges' average. */
export interface Averages {
  count: number;
  mae: number | null;
  paddle: number | null;
  judges: number | null;
}

export interface StyleDetail extends Averages {
  style: string;
}

export interface WeekDetail extends Averages {
  season: string;
  ep: number;
  week: number | null;
}

export interface ScoreCount {
  score: number;
  you: number;
  /** Dances whose judges' average rounds to this score. */
  judges: number;
}

/** One dance: the closest or furthest call. A team dance lists every member couple's dancers. */
export interface Call {
  season: string;
  ep: number;
  week: number | null;
  key: string;
  style: string | null;
  members: Member[];
  paddle: number;
  panelMean: number;
  error: number;
}

/**
 * How the owner scores. On someone else's profile it covers only dances the
 * viewer has scored too, so `count` can be below their season count.
 */
export interface Detail {
  count: number;
  mae: number | null;
  judges: Record<string, { count: number; mae: number }>;
  /** Paddle minus the judges' average: above zero is more generous. */
  gap: number | null;
  /** Closest to the judges first. */
  styles: StyleDetail[];
  /** Oldest first. */
  weeks: WeekDetail[];
  distribution: ScoreCount[];
  best: Call | null;
  worst: Call | null;
}

export interface HistoryRow extends Place {
  season: string;
  count: number;
  mae: number | null;
}

export interface Profile {
  sub: string;
  name: string | null;
  picture: string | null;
  avatarKind: AvatarKind | null;
  memberSince: string | null;
  friendCount: number;
  season: SeasonSummary;
  allTime: AllTime;
  /** Newest first. */
  recent: Activity[];
  detail: Detail;
  /** Every season with a dance counted, newest first. */
  history: HistoryRow[];
  // Only on your own profile.
  groupCount?: number;
  // Only on someone else's.
  mutual?: { friends: Person[]; groups: { id: string; name: string }[] };
}

export interface ProfileChanges {
  name?: string;
  avatar?: AvatarKind;
  uploadKey?: string;
}

interface AvatarPost {
  key: string;
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
}

export const getMyProfile = () => request<MyProfile>("/users/me");

export const getProfile = (season: string, sub: string | null = null) => {
  const query = new URLSearchParams({ season });
  if (sub) query.set("sub", sub);
  return request<Profile>(`/users/get?${query}`).then((p) => sealProfile(p, currentSeals()));
};

export const updateProfile = (changes: ProfileChanges) =>
  request<MyProfile>("/users/update", {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

/** Sends the photo straight to S3 under a presigned POST, then makes it the caller's avatar. */
export async function uploadAvatar(photo: Blob): Promise<MyProfile> {
  const post = await request<AvatarPost>("/users/avatar-upload", {
    method: "POST",
    body: JSON.stringify({ contentType: photo.type }),
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(post.fields)) form.append(k, v);
  // S3 ignores every field after the file, so it goes last.
  form.append("file", photo);
  const res = await fetch(post.url, { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, "The photo upload was refused");
  return updateProfile({ uploadKey: post.key });
}
