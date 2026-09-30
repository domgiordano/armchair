"use client";

import { useCallback, useEffect, useState } from "react";

import { getEpisodeState, type Episode, type EpisodeState } from "@/lib/api/show";
import { pollInterval } from "./poll";
import { isLive } from "./schedule";

export interface EpisodeLoad {
  data: EpisodeState | null;
  error: string | null;
  reload: () => void;
}

/**
 * Polls one episode's gated state: 10s while visible and live, 60s otherwise,
 * nothing while the tab is hidden. Coming back into view fetches at once.
 * A failed poll keeps the last good state and reports the error beside it.
 */
export function useEpisodeState(season: string, tz: string, episode: Episode): EpisodeLoad {
  const [data, setData] = useState<EpisodeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      const visible = document.visibilityState === "visible";
      const ms = pollInterval(visible, isLive(episode, tz, Date.now()));
      if (ms !== null) timer = setTimeout(load, ms);
    };

    const load = async () => {
      try {
        const next = await getEpisodeState(season, episode.ep);
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Request failed");
      }
      schedule();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
      else clearTimeout(timer);
    };

    void load();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [season, tz, episode, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, reload };
}
