import { request } from "@armchair/app-core/api/client";

export type Faction = "Faithful" | "Traitor";
export type EventType = "MURDER" | "RT" | "RECRUIT";

export interface Player {
  id: string;
  name: string;
  /** File name under /headshots/, or null before the photo pass. */
  headshot: string | null;
}

export interface WinnerPick {
  player: string;
  faction: Faction;
}

/** A current season before the caller's winner bet: nothing else is sent. */
export interface BetGate {
  season: string;
  title: string;
  current: boolean;
  needsBet: true;
  episodes: number;
  released: number;
  players: Player[];
}

export interface SeasonEpisode {
  ep: number;
  title: string | null;
  releaseAt: string;
  /** Released before the season opened here, or a past season: results for all, no picks. */
  closed: boolean;
  events: number;
  answered: number;
}

export interface SeasonView {
  season: string;
  title: string;
  current: boolean;
  needsBet: false;
  bet: { picks: WinnerPick[]; released: number } | null;
  episodes: SeasonEpisode[];
}

export type TraitorsSeason = BetGate | SeasonView;

export interface Mine {
  picks?: string[];
  forfeit?: boolean;
  submittedAt: string;
}

export interface Consensus {
  voters: number;
  picks: Record<string, number>;
  /** Round table only: who people ranked first. */
  first?: Record<string, number>;
}

export interface GroupPick {
  sub: string;
  picks: string[] | null;
  forfeit: boolean;
}

// Only a confirmed result is sent, and only the fields the poller has filled.
export interface MurderResult {
  victims?: string[];
}
export interface RoundTableResult {
  banished?: string;
  faction?: Faction;
  firstVote?: Record<string, number>;
}
export interface RecruitResult {
  recruits?: string[];
}

interface EventBase<T extends EventType, R> {
  type: T;
  /** How many players the pick names: 3 for the round table, else 1. */
  picks: number;
  mine: Mine | null;
  /** Nothing past the call to pick until you've picked or forfeited. */
  locked: boolean;
  result?: R | null;
  consensus?: Consensus;
  group?: GroupPick[];
}

export type EpisodeEvent =
  | EventBase<"MURDER", MurderResult>
  | EventBase<"RT", RoundTableResult>
  | EventBase<"RECRUIT", RecruitResult>;

export interface Episode {
  season: string;
  ep: number;
  title: string | null;
  releaseAt: string;
  closed: boolean;
  /** Everyone still in at the start of the episode. */
  roster: Player[];
  events: EpisodeEvent[];
}

export const epParam = (ep: number) => String(ep).padStart(2, "0");

export const getTraitorsSeason = (season: string) =>
  request<TraitorsSeason>(`/traitors/season?season=${encodeURIComponent(season)}`);

export const submitWinner = (season: string, picks: WinnerPick[]) =>
  request<{ picks: WinnerPick[]; released: number }>("/traitors/winner", {
    method: "POST",
    body: JSON.stringify({ season, picks }),
  });

export const getEpisode = (season: string, ep: number, group: string | null = null) => {
  const query = new URLSearchParams({ season, ep: epParam(ep) });
  if (group) query.set("group", group);
  return request<Episode>(`/traitors/episode?${query}`);
};

export interface EventStats {
  scored: number;
  hits: number;
  points: number;
}

/** The caller's own numbers, counted only from events they answered. */
export interface Stats {
  season: string;
  points: number;
  events: number;
  banishHits: number;
  byEvent: Record<EventType, EventStats>;
  byEpisode: { ep: number; points: number }[];
  winnerPoints: number | null;
}

export const getStats = (season: string) => request<Stats>(`/traitors/stats?season=${encodeURIComponent(season)}`);
