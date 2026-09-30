import { request } from "./client";

export interface Headshot {
  file: string;
  author: string;
  license: string;
  sourceUrl: string;
}

export interface Person {
  name: string;
  headshot: Headshot | null;
}

export interface Member extends Person {
  role: "celebrity" | "pro";
}

export interface Contestant {
  id: string;
  keyword: string;
  members: Member[];
}

export interface Judge extends Person {
  id: string;
}

export interface Episode {
  ep: number;
  week: number;
  airDate: string;
  start: string;
  end: string;
  theme: string | null;
}

export interface Season {
  season: string;
  timezone: string;
  episodes: Episode[];
  judges: Judge[];
  contestants: Contestant[];
}

export type Answer = { value: number } | { forfeit: true };

export interface LockedCard {
  key: string;
  contestants: string[];
  n: number;
  style: string | null;
  song: string | null;
  locked: true;
}

export interface JudgeSeat {
  id: string;
  value: number | null;
  state: "pending" | "provisional" | "confirmed";
}

export interface RevealedCard extends Omit<LockedCard, "locked"> {
  locked: false;
  judges: JudgeSeat[];
  mine: Answer | null;
  others: { sub: string; value: number }[];
  aggregate: { count: number; mean: number | null };
}

export type Card = LockedCard | RevealedCard;

export interface EpisodeState {
  season: string;
  ep: number;
  week: number;
  airDate: string;
  theme: string | null;
  panel: string[];
  rateable: number;
  answered: number;
  complete: boolean;
  performances: Card[];
  eliminated?: string[];
}

export const epParam = (ep: number) => String(ep).padStart(2, "0");

export const getSeason = (season: string) =>
  request<Season>(`/seasons/get?season=${encodeURIComponent(season)}`);

export const getEpisodeState = (season: string, ep: number) =>
  request<EpisodeState>(`/episodes/state?season=${encodeURIComponent(season)}&ep=${epParam(ep)}`);

export const submitScore = (season: string, ep: number, card: LockedCard, answer: Answer) =>
  request<unknown>("/scores/submit", {
    method: "POST",
    body: JSON.stringify({
      season,
      ep: epParam(ep),
      contestant: card.contestants[0],
      n: card.n,
      ...answer,
    }),
  });

export const revealAll = (season: string, ep: number) =>
  request<{ revealed: string[] }>("/scores/reveal-all", {
    method: "POST",
    body: JSON.stringify({ season, ep: epParam(ep) }),
  });
