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
  style: string | null;
  /** The panel's values on this dance, by judge id. */
  judges: Record<string, number>;
}

export interface Stats {
  season: string;
  ep: number | null;
  mine: Accuracy;
  episodes: (Accuracy & { ep: number })[];
  dances: Dance[];
  others: { sub: string; count: number; mae: number }[];
}

export const getStats = (season: string, group: string | null = null) => {
  const query = new URLSearchParams({ season });
  if (group) query.set("group", group);
  return request<Stats>(`/stats/get?${query}`);
};
