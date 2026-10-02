/**
 * Stale-while-revalidate for API reads, in memory and sessionStorage, keyed by
 * user and path. A fresh entry answers without a request; a stale one answers
 * at once while a request refreshes it for next time; past that, the caller
 * waits. Identical requests in flight share one fetch. Any write clears it all
 * except the season catalog, since a score, a friend or a group changes most
 * of what the other endpoints return.
 */

const SEC = 1000;
const MIN = 60 * SEC;

interface Policy {
  /** Served with no request. */
  fresh: number;
  /** After `fresh`, served while a request refreshes it. */
  stale: number;
}

// First match wins. Paths not listed are never cached.
const POLICIES: [prefix: string, policy: Policy][] = [
  // The public schedule and roster: the catalog changes when a season is seeded.
  ["/seasons/", { fresh: 10 * MIN, stale: 24 * 60 * MIN }],
  ["/users/me", { fresh: 5 * MIN, stale: 60 * MIN }],
  // Long enough for a page to pick up its own prefetch, short of the episode
  // page's 10 s poll, and never served stale: it is the gate's view.
  ["/episodes/state", { fresh: 5 * SEC, stale: 0 }],
  ["/friends/search", { fresh: MIN, stale: 0 }],
  ["/overview/", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/stats/", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/leaderboard/", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/performers/", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/week-board/", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/users/get", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/people/get", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/friends/list", { fresh: 30 * SEC, stale: 10 * MIN }],
  ["/groups/mine", { fresh: 30 * SEC, stale: 10 * MIN }],
];

const KEEP_ON_WRITE = "/seasons/";
const STORE = "armchair.api:";

interface Entry {
  at: number;
  value: unknown;
}

// Keys are `${sub}:${path}`, so one person never reads another's entries.
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
// Bumped by every write, so a read that started before it never stores what it got.
let generation = 0;

const policy = (path: string) => POLICIES.find(([prefix]) => path.startsWith(prefix))?.[1];
const pathOf = (key: string) => key.slice(key.indexOf(":") + 1);

function stored(): string[] {
  try {
    return Object.keys(sessionStorage).filter((k) => k.startsWith(STORE));
  } catch {
    // Storage disabled (Safari private mode): nothing was stored.
    return [];
  }
}

function read(key: string): Entry | undefined {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(STORE + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry;
    memory.set(key, entry);
    return entry;
  } catch {
    // Storage disabled or a corrupt entry: fetch instead.
    return undefined;
  }
}

function write(key: string, entry: Entry): void {
  memory.set(key, entry);
  try {
    sessionStorage.setItem(STORE + key, JSON.stringify(entry));
  } catch {
    // Full or disabled: keep it in memory for this page and drop the stored set,
    // so a reload doesn't mix entries from before and after.
    for (const k of stored()) sessionStorage.removeItem(k);
  }
}

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const started = generation;
  const p = fetcher()
    .then((value) => {
      if (started === generation) write(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** `fetcher`'s result for `path`, from the cache when its policy allows. */
export function cached<T>(sub: string, path: string, fetcher: () => Promise<T>): Promise<T> {
  const rule = policy(path);
  if (!rule) return fetcher();
  const key = `${sub}:${path}`;
  const hit = read(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < rule.fresh) return Promise.resolve(hit.value as T);
  const next = load(key, fetcher);
  if (hit && age < rule.fresh + rule.stale) {
    // The page gets the stale value now; a failed refresh just leaves it stale.
    next.catch(() => {});
    return Promise.resolve(hit.value as T);
  }
  return next;
}

/** After a write: forget everything but the season catalog. */
export function invalidate(): void {
  generation += 1;
  inflight.clear();
  for (const key of [...memory.keys()]) if (!pathOf(key).startsWith(KEEP_ON_WRITE)) memory.delete(key);
  for (const k of stored()) if (!pathOf(k.slice(STORE.length)).startsWith(KEEP_ON_WRITE)) sessionStorage.removeItem(k);
}

/** On sign-out, so the next person on this tab starts empty. */
export function clearCache(): void {
  generation += 1;
  inflight.clear();
  memory.clear();
  for (const k of stored()) sessionStorage.removeItem(k);
}
