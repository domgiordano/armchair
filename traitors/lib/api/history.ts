import { request } from "@armchair/app-core/api/client";

import type { Exit, Faction, Writeup } from "@/lib/api/traitors";
import type { Show } from "@/lib/seasons";

export type { Exit };

export interface HistoryPlayer {
  id: string;
  name: string;
  headshot: string | null;
  faction: Faction | null;
  exit: Exit | null;
}

export interface HistoryEpisode {
  ep: number;
  title: string | null;
  airDate: string | null;
  releaseAt: string;
  roundTable: { banished: string; faction: Faction | null; firstVote: Record<string, number> } | null;
  murdered: string[] | null;
  recruited: string[] | null;
  recap?: Writeup | null;
}

/** A finished season in one read. The current season is a 403: it goes episode by episode. */
export interface History {
  season: string;
  title: string | null;
  winners: { id: string; faction: Faction | null }[];
  players: HistoryPlayer[];
  episodes: HistoryEpisode[];
}

export const getHistory = (season: string) =>
  request<History>(`/traitors/history?season=${encodeURIComponent(season)}`);

export interface Career {
  season: string;
  number: number;
  current: boolean;
  /** A current season shows only exits from closed episodes. */
  finish: Exit | null;
  faction: Faction | null;
  /** First votes drawn at each round table sat at; null for the current season. */
  votes: { ep: number; received: number }[] | null;
  /** Won the season. */
  championship: boolean;
  /** The episode they became a Traitor; null unless that's yours to know. */
  traitorFrom?: number | null;
}

/** One episode of a player's season, only as far as the caller may see. */
export interface StoryEpisode {
  season: string;
  ep: number;
  title: string | null;
  /** Who they voted to banish; null with no round table or no vote on record. */
  voted: string | null;
  votesReceived: number | null;
  shield: boolean;
  out: { how: string } | null;
  /** As a Traitor: found dead at this episode's breakfast. Null when not theirs, or not yours to know. */
  murdered?: string[] | null;
  /** As a Traitor: recruited this episode's night. */
  recruited?: string[] | null;
}

export interface PlayerProfile {
  id: string;
  name: string;
  headshot: string | null;
  bio: Writeup | null;
  /** Their row of the season's contestants table; occupation is what a celebrity is known for. */
  about?: { age: number | null; hometown: string | null; occupation: string | null } | null;
  seasons: Career[];
  story?: StoryEpisode[];
  /** Name and photo of everyone the story names, by id. */
  people?: Record<string, { name: string; headshot: string | null }>;
}

export const getPlayer = (show: Show, id: string) =>
  request<PlayerProfile>(`/traitors/player?${new URLSearchParams({ show, id })}`);

export interface PlayerHit {
  id: string;
  name: string;
  headshot: string | null;
  seasons: number[];
}

export const SEARCH_MIN = 2;

export const searchPlayers = (show: Show, q: string) =>
  request<{ players: PlayerHit[] }>(`/people/search?${new URLSearchParams({ show, q })}`).then((r) => r.players);
