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

/** How a player left: "banished", "murdered", "winner", or whatever word the page used. */
export interface Exit {
  ep: number;
  how: string;
}

/** A season's player. Faction and exit are sent only once they're out in an episode you may see. */
export interface CastMember extends Player {
  faction: Faction | null;
  exit: Exit | null;
}

export type WriteupSource = "wikipedia" | "fandom";

export interface Writeup {
  text: string;
  /** Where it's from; absent means Wikipedia. Both are CC BY-SA, so always linked. */
  source?: WriteupSource;
  sourceUrl: string;
}

export interface SeasonEpisode {
  ep: number;
  title: string | null;
  releaseAt: string;
  /** Released before the season opened here, or a past season: results for all, no picks. */
  closed: boolean;
  events: number;
  answered: number;
  /** A finished season's episode recap. */
  recap?: Writeup | null;
}

/** Everything is browsable before the bet; only picks wait for it (403). */
export interface SeasonView {
  season: string;
  title: string;
  current: boolean;
  needsBet: boolean;
  /** Who the bet may name, sent while it's needed. */
  betRoster?: Player[];
  bet: { picks: WinnerPick[]; released: number } | null;
  episodes: SeasonEpisode[];
  summary: Writeup | null;
  /** A finished season's champions. */
  winners?: (Player & { faction: Faction | null })[];
  cast: CastMember[];
}

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
  /** Who each player voted to banish, voter id to target id, once the round table is unlocked for you. */
  ballots?: Record<string, string>;
  /** Who held a shield that night. */
  shields?: string[];
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
  /** Who left before it, with their faction once it's known. */
  out: (Exit & { id: string; faction: Faction | null })[];
  /** Picks wait for the winner bet; the episode still shows. */
  needsBet: boolean;
  events: EpisodeEvent[];
  /** Sent only once you've made every call, or the episode is closed. */
  recap?: Writeup;
}

export const epParam = (ep: number) => String(ep).padStart(2, "0");

export const getTraitorsSeason = (season: string) =>
  request<SeasonView>(`/traitors/season?season=${encodeURIComponent(season)}`);

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

/** Final: the same call again is 200, a different one 409, a closed episode 403. */
export const submitPick = (
  season: string,
  ep: number,
  event: EventType,
  answer: { picks: string[] } | { forfeit: true },
) =>
  request<Mine & { event: EventType }>("/traitors/pick", {
    method: "POST",
    body: JSON.stringify({ season, ep: epParam(ep), event, ...answer }),
  });

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

export type Scope = "global" | "friends" | "group";

export interface Standing {
  rank: number;
  sub: string;
  name: string | null;
  picture: string | null;
  points: number;
  events: number;
  banishHits: number;
  /** Points per scored event, null before any. */
  average: number | null;
}

export interface Ranks {
  season: string;
  scope: Scope;
  group: string | null;
  ranked: Standing[];
  me: Standing;
}

/** `season` is a season id, or "all" with the edition's `show` for all-time. */
export function getRanks(season: string, show: string, scope: Scope, group: string | null) {
  const query = new URLSearchParams({ season, scope });
  if (season === "all") query.set("show", show);
  if (scope === "group" && group) query.set("group", group);
  return request<Ranks>(`/traitors/ranks?${query}`);
}
