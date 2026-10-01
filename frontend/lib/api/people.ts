import { request } from "./client";
import type { Match } from "./social";

export type Role = "celebrity" | "pro" | "judge";

/** A star, pro or judge from the cross-season index. */
export interface PersonHit {
  id: string;
  name: string;
  /** Most recent role first. */
  roles: Role[];
  /** Our crop under /headshots/, or null. */
  headshot: string | null;
  seasons: number[];
}

export interface SearchResults {
  users: Match[];
  stars: PersonHit[];
  pros: PersonHit[];
  judges: PersonHit[];
}

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 40;

export const searchAll = (q: string) => request<SearchResults>(`/people/search?q=${encodeURIComponent(q)}`);

export const profileHref = (sub: string) => `/profile/?u=${encodeURIComponent(sub)}`;
