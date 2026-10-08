"use client";

import { useEffect, useState } from "react";

export type Load<T> = { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };

/** One fetch keyed by its arguments, with retry. */
export function useFetch<T>(fetcher: () => Promise<T>, key: string): [Load<T>, () => void] {
  const [load, setLoad] = useState<{ key: string; load: Load<T> }>({ key, load: { kind: "loading" } });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (value) => !cancelled && setLoad({ key, load: { kind: "ready", value } }),
      (e: unknown) =>
        !cancelled && setLoad({ key, load: { kind: "error", message: e instanceof Error ? e.message : "Request failed" } }),
    );
    return () => {
      cancelled = true;
    };
    // The key stands for the fetcher's arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const retry = () => {
    setLoad({ key, load: { kind: "loading" } });
    setAttempt((n) => n + 1);
  };
  return [load.key === key ? load.load : { kind: "loading" }, retry];
}
