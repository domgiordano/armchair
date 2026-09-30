"use client";

import { useSearchParams } from "next/navigation";

export const CURRENT_SEASON = "dwts-35";

// Past seasons join this list as they're backfilled.
export const SEASONS = [{ id: "dwts-35", label: "Season 35" }];

const SEASON_ID = /^dwts-\d{1,3}$/;

export function seasonLabel(id: string): string {
  return SEASONS.find((s) => s.id === id)?.label ?? `Season ${id.split("-")[1]}`;
}

/** The `season` URL param, or the current season when it's missing or malformed. */
export function useSeasonId(): string {
  const asked = useSearchParams().get("season");
  return asked && SEASON_ID.test(asked) ? asked : CURRENT_SEASON;
}

/** `href` carrying the season, which is left off for the current one so links stay clean. */
export function withSeason(href: string, season: string): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (season === CURRENT_SEASON) params.delete("season");
  else params.set("season", season);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
