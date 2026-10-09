import { request } from "@armchair/app-core/api/client";

export interface Headshot {
  // The Commons file, credited on /credits. A supplied photo has none.
  file?: string;
  // Our face-centred square crop of it, under /headshots/.
  image: string;
  author: string;
  license: string;
  sourceUrl: string | null;
  // "auto": the poller copied a guest judge's Commons thumbnail on the night, uncropped.
  source?: "supplied" | "auto";
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
  /** Off the season's regular panel. */
  guest?: boolean;
  /** A guest's weeks on the panel, aired ones only. */
  weeks?: number[];
}

/** When an episode takes answers: from air time until the next episode airs. */
export interface ScoringWindow {
  opensAt: string | null;
  closesAt: string | null;
  open: boolean;
}

/** The episode taking answers now, with the caller's progress on it. */
export interface ActiveEpisode {
  ep: number;
  opensAt: string | null;
  closesAt: string | null;
  answered: number;
  rateable: number;
}

/** A 409 from a write to an episode outside its window. */
export const CLOSED = "episode_closed";

// A past season's fixture has no start or end times, and some lack the air date.
// `window` and `activeEpisode` are absent from an API older than scoring windows.
export interface Episode {
  ep: number;
  week: number;
  airDate: string | null;
  start: string | null;
  end: string | null;
  theme: string | null;
  window?: ScoringWindow;
}

export interface Season {
  season: string;
  /** A past season: every score and result shows to everyone, and nothing takes a paddle. */
  open: boolean;
  timezone: string;
  episodes: Episode[];
  judges: Judge[];
  contestants: Contestant[];
  activeEpisode?: ActiveEpisode | null;
}

export type Answer = { value: number } | { forfeit: true };

/** An AI write-up of one dance from published recaps. Any field can be empty when the recaps said nothing. */
export interface Writeup {
  summary: string | null;
  /** One short paraphrase per judge the recaps quoted; `quote` is at most six of their own words. */
  judges: { id: string; text: string; quote: string | null }[];
  highlights: string[];
  sources: string[];
}

/** What a locked card may say of its write-up: only that there is one. */
export interface LockedWriteup {
  locked: true;
}

export interface LockedCard {
  key: string;
  contestants: string[];
  n: number;
  style: string | null;
  song: string | null;
  locked: true;
  writeup?: LockedWriteup | null;
}

export interface JudgeSeat {
  id: string;
  value: number | null;
  state: "pending" | "provisional" | "confirmed";
}

export interface RevealedCard extends Omit<LockedCard, "locked" | "writeup"> {
  locked: false;
  writeup?: Writeup | null;
  judges: JudgeSeat[];
  mine: Answer | null;
  others: { sub: string; value: number }[];
  aggregate: { count: number; mean: number | null };
}

export type Card = LockedCard | RevealedCard;

/** What the poller writes once every score is confirmed: who went home and each couple's total. */
export interface EpisodeResults {
  eliminated: string[];
  totals: Record<string, number>;
  bonus: Record<string, number>;
}

export interface EpisodeState {
  season: string;
  ep: number;
  week: number;
  airDate: string | null;
  theme: string | null;
  panel: string[];
  open: boolean;
  rateable: number;
  answered: number;
  complete: boolean;
  performances: Card[];
  eliminated?: string[];
  /** With `eliminated`, once the caller has finished the episode; null until the poller writes them. */
  results?: EpisodeResults | null;
  window?: ScoringWindow;
  activeEpisode?: ActiveEpisode | null;
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
