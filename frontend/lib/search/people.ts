import type { PersonHit, SearchResults } from "@/lib/api/people";
import { getFriends, searchPeople, type Match } from "@armchair/app-core/api/social";

import { search } from "./match";

const LIMIT = 8;
// /friends/search returns at most this many; fewer means the list was complete.
const SERVER_LIMIT = 20;

let index: Promise<PersonHit[]> | null = null;

/**
 * Every star, pro and judge, built from the fixtures at build time
 * (scripts/build-people-index.mjs). Its own hashed chunk, fetched the first time
 * search is opened or hovered. Most recent season first, so ties rank that way.
 */
export function loadIndex(): Promise<PersonHit[]> {
  index ??= import("./people-index.json").then(
    (m) =>
      [...(m.default as PersonHit[])].sort(
        (a, b) => Math.max(...b.seasons) - Math.max(...a.seasons) || a.name.localeCompare(b.name),
      ),
    (e: unknown) => {
      index = null;
      throw e;
    },
  );
  return index;
}

const GROUP = { celebrity: "stars", pro: "pros", judge: "judges" } as const;

/** Stars, pros and judges matching `q`, each under the role they held most recently. */
export function searchIndex(people: readonly PersonHit[], q: string): Omit<SearchResults, "users"> {
  const out: Omit<SearchResults, "users"> = { stars: [], pros: [], judges: [] };
  for (const p of search(people, q, (p) => p.name, Infinity)) {
    const group = out[GROUP[p.roles[0]]];
    if (group.length < LIMIT) group.push(p);
  }
  return out;
}

/** Friends and both directions of request: the people a search should find without asking. */
export async function loadContacts(): Promise<Match[]> {
  const f = await getFriends();
  return [
    ...f.friends.map((p) => ({ ...p, status: "friend" as const })),
    ...f.incoming.map((p) => ({ ...p, status: "incoming" as const })),
    ...f.outgoing.map((p) => ({ ...p, status: "outgoing" as const })),
  ].map(({ sub, name, picture, avatarKind, status }) => ({ sub, name, picture, avatarKind, status }));
}

// The server's normalize(): case and spacing only, accents kept.
const serverFold = (s: string) => s.split(/\s+/).filter(Boolean).join(" ").toLowerCase();

// Statuses change with friend requests and blocks made elsewhere in the app.
const MEMBERS_TTL = 60_000;
const found = new Map<string, { at: number; list: Match[] }>();

export const startsWith = (m: Match, q: string) => serverFold(m.name ?? "").startsWith(serverFold(q));

/**
 * Members whose name starts with `q`, from memory: this query was asked already,
 * or a shorter one was and its list wasn't cut off. Undefined when it needs the server.
 */
export function knownMembers(q: string): Match[] | undefined {
  const key = serverFold(q);
  for (let n = key.length; n >= 2; n--) {
    const hit = found.get(key.slice(0, n));
    if (!hit || Date.now() - hit.at > MEMBERS_TTL) continue;
    if (n === key.length || hit.list.length < SERVER_LIMIT) return hit.list.filter((m) => startsWith(m, key));
  }
  return undefined;
}

/** Members whose name starts with `q`, from /friends/search. */
export async function searchMembers(q: string): Promise<Match[]> {
  const known = knownMembers(q);
  if (known) return known;
  const key = serverFold(q);
  const got = await searchPeople(key);
  found.set(key, { at: Date.now(), list: got });
  return got;
}

export const forgetMembers = () => found.clear();

/** Contacts matched here and members from the server, contacts first, one row per person. */
export function mergeUsers(contacts: readonly Match[], members: readonly Match[], q: string): Match[] {
  const mine = search(contacts, q, (c) => c.name ?? "", LIMIT);
  const seen = new Set(mine.map((m) => m.sub));
  return [...mine, ...members.filter((m) => !seen.has(m.sub))].slice(0, LIMIT);
}
