import { request } from "./client";
import type { Headshot, Member } from "./show";

/** Other people's mean on the caller's dances; null under two raters, so one paddle never shows. */
export interface Crowd {
  mean: number | null;
  raters: number;
}

/** The caller against the judges. `gap` is paddle minus the judges' mean: positive is softer. */
export interface VersusJudges {
  dances: number;
  you: number;
  judges: number | null;
  judged: number;
  gap: number | null;
  absGap: number | null;
}

export interface CoupleDance {
  ep: number;
  week: number | null;
  key: string;
  style: string | null;
  paddle: number;
  judges: number | null;
}

export interface CoupleStats extends VersusJudges {
  /** `season/id`: a returning all-star keeps their id across seasons. */
  ref: string;
  id: string;
  season: string;
  members: Member[];
  friends: Crowd;
  everyone: Crowd;
  best: CoupleDance;
  worst: CoupleDance;
  weeks: CoupleDance[];
}

export interface PersonStats extends VersusJudges {
  name: string;
  headshot: Headshot | null;
  seasons: string[];
  couples: number;
}

export interface Performers {
  season: string;
  group: string | null;
  couples: CoupleStats[];
  pros: PersonStats[];
  celebrities: PersonStats[];
  favorites: string[];
  leastFavorites: string[];
  softerOn: string[];
  tougherOn: string[];
}

export const ALL_SEASONS = "all";

export const getPerformers = (season: string, group: string | null) => {
  const query = new URLSearchParams({ season });
  if (group) query.set("group", group);
  return request<Performers>(`/performers/get?${query}`);
};

export type BoardColumn = "judges" | "you" | "friends" | "everyone";
export type BoardScope = "global" | "friends" | "group";

export interface BoardRow {
  id: string;
  members: Member[];
  dances: number;
  styles: (string | null)[];
  you: number;
  judges: number | null;
  judgesTotal: number | null;
  friends: number | null;
  everyone: number | null;
  ranks: Record<BoardColumn, number | null>;
  /** Judges' rank minus yours: positive when you placed them higher. */
  rankDelta: number | null;
}

export interface WeekBoard {
  season: string;
  ep: number;
  week: number | null;
  theme: string | null;
  panel: string[];
  scope: BoardScope;
  group: string | null;
  rateable: number;
  answered: number;
  couples: BoardRow[];
  locked: { id: string; members: Member[] }[];
  disagreements: string[];
}

export const getWeekBoard = (season: string, ep: number, group: string | null) => {
  const query = new URLSearchParams({ season, ep: String(ep).padStart(2, "0"), scope: group ? "group" : "global" });
  if (group) query.set("group", group);
  return request<WeekBoard>(`/week-board/get?${query}`);
};
