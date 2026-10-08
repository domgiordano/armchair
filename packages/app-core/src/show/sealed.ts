"use client";

import { useSyncExternalStore } from "react";

/**
 * Answers locked in on this device whose results stay face down until you choose
 * to look, across reloads and tabs. The server shows a result as soon as you
 * answer; a show app keeps it hidden while the id is here. Older answers and
 * other devices aren't listed, so they show as they always did.
 */
export interface SealStore {
  seal: (id: string) => void;
  /** Turns over every id `match` accepts. */
  reveal: (match: (id: string) => boolean) => void;
  /** The sealed ids. Nothing is sealed on the server render. */
  useSealed: () => ReadonlySet<string>;
}

const parse = (s: string): string[] => {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function sealStore(key: string): SealStore {
  const listeners = new Set<() => void>();
  // Storage throws when disabled (Safari private mode); a seal then lasts until the tab closes.
  let fallback = "[]";
  const raw = () => {
    try {
      return window.localStorage.getItem(key) ?? "[]";
    } catch {
      return fallback;
    }
  };
  const write = (ids: string[]) => {
    fallback = JSON.stringify(ids);
    try {
      window.localStorage.setItem(key, fallback);
    } catch {
      // See raw.
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    // Another tab revealing turns it over here too.
    const onStorage = (e: StorageEvent) => e.key === key && fn();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  };
  // One Set per snapshot string, so every render of an unchanged store sees the same object.
  let last: { raw: string; ids: ReadonlySet<string> } = { raw: "[]", ids: new Set() };
  const ids = (s: string) => {
    if (s !== last.raw) last = { raw: s, ids: new Set(parse(s)) };
    return last.ids;
  };

  return {
    seal(id) {
      const now = parse(raw());
      if (!now.includes(id)) write([...now, id]);
    },
    reveal(match) {
      const now = parse(raw());
      if (now.some(match)) write(now.filter((id) => !match(id)));
    },
    useSealed() {
      return ids(useSyncExternalStore(subscribe, raw, () => "[]"));
    },
  };
}
