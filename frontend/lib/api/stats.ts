import { request } from "./client";

export interface Accuracy {
  count: number;
  mae: number | null;
  judges: Record<string, { count: number; mae: number }>;
}

export interface Dance {
  ep: number;
  key: string;
  paddle: number;
  panelMean: number;
  error: number;
}

export interface Stats {
  season: string;
  ep: number | null;
  mine: Accuracy;
  episodes: (Accuracy & { ep: number })[];
  dances: Dance[];
  others: { sub: string; count: number; mae: number }[];
}

export const getStats = (season: string) =>
  request<Stats>(`/stats/get?season=${encodeURIComponent(season)}`);
