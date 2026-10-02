"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { getTraitorsSeason, type SeasonView } from "@/lib/api/traitors";

export interface SeasonData {
  view: SeasonView;
  reload: () => void;
}

export const SeasonDataContext = createContext<SeasonData | null>(null);

/** The open season's schedule and your progress in it. Every season page under the shell has one. */
export function useSeasonView(): SeasonData {
  const value = useContext(SeasonDataContext);
  if (!value) throw new Error("useSeasonView needs the shell's season data");
  return value;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

interface Loaded {
  season: string;
  data: SeasonView | null;
  error: string | null;
}

/**
 * /traitors/season for the shell. A reload keeps showing what it had until the
 * answer arrives, so locking the bet doesn't flash a skeleton.
 */
export function useSeasonLoad(season: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Loaded | null>(null);

  useEffect(() => {
    if (season === null) return;
    let cancelled = false;
    getTraitorsSeason(season).then(
      (data) => !cancelled && setLoad({ season, data, error: null }),
      (e: unknown) => !cancelled && setLoad((prev) => ({ season, data: prev?.season === season ? prev.data : null, error: errorText(e) })),
    );
    return () => {
      cancelled = true;
    };
  }, [season, attempt]);

  const current = load?.season === season ? load : null;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data: current?.data ?? null, error: current?.error ?? null, reload };
}
