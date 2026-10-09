"use client";

import { useEffect, useState } from "react";

import type { Headshot } from "@/lib/api/show";
import { getOdds, type OddsBoard } from "@armchair/app-core/favorites/odds";

export type DwtsOdds = OddsBoard<Headshot | null>;
export type OddsLoad = { kind: "loading" } | { kind: "ready"; board: DwtsOdds } | { kind: "error"; message: string; retry: () => void };

/**
 * favorites_get for a DWTS season, as of episode `through` at the latest. The
 * server never serves a board past what the caller has revealed, whatever is asked.
 */
export function useOdds(season: string, through?: number): OddsLoad {
  const [load, setLoad] = useState<OddsLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOdds<Headshot | null>(season, through).then(
      (board) => !cancelled && setLoad({ kind: "ready", board }),
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
  }, [season, through, attempt]);

  return load;
}
