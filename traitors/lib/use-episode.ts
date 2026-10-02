"use client";

import { useCallback, useEffect, useState } from "react";

import { getEpisode, type Episode } from "@/lib/api/traitors";

export type EpisodeLoad = { kind: "loading" } | { kind: "ready"; episode: Episode } | { kind: "error"; message: string };

/** One episode, fetched once. The ballot polls instead; this is for summaries and the cast. */
export function useEpisode(season: string, ep: number | null): { load: EpisodeLoad; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<{ key: string; value: EpisodeLoad } | null>(null);
  const key = `${season}#${ep}#${attempt}`;

  useEffect(() => {
    if (ep === null) return;
    let cancelled = false;
    getEpisode(season, ep).then(
      (episode) => !cancelled && setLoad({ key, value: { kind: "ready", episode } }),
      (e: unknown) =>
        !cancelled && setLoad({ key, value: { kind: "error", message: e instanceof Error ? e.message : "Request failed" } }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, ep, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { load: load?.key === key ? load.value : { kind: "loading" }, retry };
}
