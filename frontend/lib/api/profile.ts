import { ApiError, request, type AvatarKind, type Me } from "./client";

/** /users/me as its owner sees it: the effective name and photo plus what they can switch to. */
export interface MyProfile extends Me {
  customName: string | null;
  googleName: string | null;
  googlePicture: string | null;
  uploadPicture: string | null;
}

export interface SeasonSummary {
  season: string;
  count: number;
  // Null until there is something to compare, and for someone else below five dances.
  mae: number | null;
  judges: Record<string, { count: number; mae: number }>;
}

export interface ProfileDance {
  ep: number;
  key: string;
  style: string | null;
  paddle: number;
  panelMean: number;
  error: number;
}

export interface Profile {
  sub: string;
  name: string | null;
  picture: string | null;
  avatarKind: AvatarKind | null;
  memberSince: string | null;
  season: SeasonSummary;
  friendCount?: number;
  // Only on your own profile.
  groupCount?: number;
  dances?: ProfileDance[];
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
  return request<Profile>(`/users/get?${query}`);
};

export const updateProfile = (changes: ProfileChanges) =>
  request<MyProfile>("/users/update", { method: "PATCH", body: JSON.stringify(changes) });

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
