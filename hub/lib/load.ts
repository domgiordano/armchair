"use client";

import { useCallback, useEffect, useState } from "react";

export type Load<T> = { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };

export const message = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

/** Fetches on mount and on reload(); keeps the last good value on screen while reloading. */
export function useLoad<T>(fetcher: () => Promise<T>): [Load<T>, () => void, (value: T) => void] {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (value) => !cancelled && setLoad({ kind: "ready", value }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: message(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher, attempt]);

  return [
    load,
    useCallback(() => setAttempt((n) => n + 1), []),
    useCallback((value: T) => setLoad({ kind: "ready", value }), []),
  ];
}

/** Runs one action at a time for a row, and keeps its error beside it. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}
