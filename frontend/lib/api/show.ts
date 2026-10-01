import { request } from "./client";

export interface Headshot {
  // The Commons file, credited on /credits.
  file: string;
  // Our face-centred square crop of it, under /headshots/.
  image: string;
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

// A past season's fixture has no start or end times, and some lack the air date.
export interface Episode {
  ep: number;
  week: number;
  airDate: string | null;
  start: string | null;
  end: string | null;
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
  airDate: string | null;
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

export const getEpisodeState = (season: string, ep: number, group: string | null = null) => {
  const query = new URLSearchParams({ season, ep: epParam(ep) });
  if (group) query.set("group", group);
  return request<EpisodeState>(`/episodes/state?${query}`);
};

export const submitScore = (season: string, ep: number, card: LockedCard, answer: Answer) =>
  request<unknown>("/scores/submit", {
    method: "POST",
    body: JSON.stringify({
      season,
      ep: epParam(ep),
      // A team dance's key names every member couple: "a+b+c#1".
      contestant: card.key.slice(0, card.key.lastIndexOf("#")),
      n: card.n,
      ...answer,
    }),
  });

export const revealAll = (season: string, ep: number) =>
  request<{ revealed: string[] }>("/scores/reveal-all", {
    method: "POST",
    body: JSON.stringify({ season, ep: epParam(ep) }),
  });

/** Forfeits every unanswered dance in the aired episodes before `ep`; one past the last skips the season. */
export const skipBefore = (season: string, ep: number) =>
  request<{ revealed: { ep: number; keys: string[] }[] }>("/scores/skip-before", {
    method: "POST",
    body: JSON.stringify({ season, ep: epParam(ep) }),
  });
