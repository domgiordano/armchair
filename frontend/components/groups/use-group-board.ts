"use client";

import { useCallback, useEffect, useState } from "react";

import { getLeaderboard, type Leaderboard } from "@/lib/api/leaderboard";

export type BoardLoad = { kind: "loading" } | { kind: "ready"; board: Leaderboard } | { kind: "error"; message: string };

/** One group's leaderboard for a season. The read is cached, so a card and its page share it. */
export function useGroupBoard(group: string, season: string): [BoardLoad, () => void] {
  const [load, setLoad] = useState<BoardLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(season, "group", group).then(
      (board) => !cancelled && setLoad({ kind: "ready", board }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [group, season, attempt]);

  const retry = useCallback(() => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return [load, retry];
}
