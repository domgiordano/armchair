import { request } from "./client";
import type { Answer, Headshot, JudgeSeat, Member } from "./show";

export interface OverviewEpisode {
  ep: number;
  week: number;
  theme: string | null;
  airDate: string;
  startsAt: string;
  endsAt: string;
  aired: boolean;
  // Only on aired episodes.
  rateable?: number;
  answered?: number;
  complete?: boolean;
  scored?: number;
  mae?: number | null;
}

export interface Reveal {
  ep: number;
  key: string;
  contestants: string[];
  style: string | null;
  song: string | null;
  judges: JudgeSeat[];
  mine: Answer;
  panelMean: number | null;
}

export interface CoupleStanding {
  id: string;
  members: Member[];
  dances: number;
  average: number | null;
  out: boolean;
}

export interface Overview {
  season: string;
  timezone: string;
  judges: { id: string; name: string; headshot: Headshot | null }[];
  progress: { aired: number; total: number; couples: number; couplesLeft: number };
  me: {
    scored: number;
    count: number;
    mae: number | null;
    closestJudge: { id: string; name: string | null; mae: number } | null;
    streak: number;
  };
  next: Pick<OverviewEpisode, "ep" | "week" | "theme" | "airDate" | "startsAt"> | null;
  episodes: OverviewEpisode[];
  reveals: Reveal[];
  couples: CoupleStanding[];
}

export const getOverview = (season: string) =>
  request<Overview>(`/overview/get?season=${encodeURIComponent(season)}`);

export interface Standing {
  rank: number;
  sub: string;
  name: string | null;
  picture: string | null;
  count: number;
  mae: number;
}

export interface Leaderboard {
  minDances: number;
  ranked: Standing[];
  me: { sub: string; rank: number | null };
}

export const getLeaderboard = (season: string) =>
  request<Leaderboard>(`/leaderboard/get?season=${encodeURIComponent(season)}&scope=global`);
