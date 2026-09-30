"use client";

import { useEffect, useState } from "react";

import { getSeason, type Season } from "@/lib/api/show";

export const SEASON = "dwts-35";

export type SeasonLoad =
  | { kind: "loading" }
  | { kind: "ready"; season: Season }
  | { kind: "error"; message: string; retry: () => void };

export function useSeason(): SeasonLoad {
  const [load, setLoad] = useState<SeasonLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSeason(SEASON).then(
      (season) => !cancelled && setLoad({ kind: "ready", season }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
          retry: () => {
            setLoad({ kind: "loading" });
            setAttempt((n) => n + 1);
          },
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return load;
}
