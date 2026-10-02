"use client";

import { useCallback, useEffect, useState } from "react";

import { getEpisode, type Episode } from "@/lib/api/traitors";
import { isLive } from "@/lib/schedule";
import { pollInterval } from "@armchair/app-core/show/poll";

export interface EpisodePoll {
  data: Episode | null;
  error: string | null;
  reload: () => void;
}

/**
 * Polls one episode's gated view: 10s while visible around its release, 60s
 * otherwise, nothing while the tab is hidden. Coming back into view fetches at
 * once. A failed poll keeps the last good view and reports the error beside it.
 */
export function useEpisodePoll(season: string, ep: number, releaseAt: string, group: string | null): EpisodePoll {
  const [data, setData] = useState<Episode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      const ms = pollInterval(document.visibilityState === "visible", isLive(releaseAt, Date.now()));
      if (ms !== null) timer = setTimeout(load, ms);
    };

    const load = async () => {
      try {
        const next = await getEpisode(season, ep, group);
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
  }, [season, ep, releaseAt, group, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, reload };
}
