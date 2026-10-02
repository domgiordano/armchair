import { vi } from "vitest";

import type { Notification, Person } from "@/lib/api/social";

// A fake of the API's envelope responses, keyed by path. Test fixtures only:
// every name here is invented.

export const person = (sub: string, name: string): Person => ({ sub, name, picture: null, avatarKind: "initials" });

export const ME = {
  sub: "me-1",
  email: "pat@example.com",
  name: "Pat Couch",
  picture: null,
  avatarKind: "initials",
  createdAt: "2026-09-01T00:00:00Z",
  lastSeenAt: "2026-10-01T00:00:00Z",
  customName: null,
  googleName: "Pat Couch",
  googlePicture: null,
  uploadPicture: null,
};

export const INVITE: Notification = {
  id: "n-1",
  type: "group_invite",
  read: false,
  state: "pending",
  at: "2026-09-30T20:00:00Z",
  from: person("u-3", "Robin Sofa"),
  group: { id: "g-2", name: "Ballroom Bench" },
};

type Route = (body: unknown, init: RequestInit, url: URL) => { data?: unknown; meta?: unknown; status?: number };

const SEASONS: Record<string, unknown[]> = {
  dwts: [{ id: "dwts-35", number: 35, year: 2026, current: true }],
  tus: [{ id: "tus-5", number: 5, year: 2026, current: true }],
  tuk: [{ id: "tuk-4", number: 4, year: 2026, current: false }],
  tukc: [{ id: "tukc-2", number: 2, year: 2026, current: true }],
};

export const traitorsStats = (points: number) => ({
  points,
  events: 6,
  banishHits: 1,
  byEvent: {
    RT: { scored: 2, hits: 1, points: points - 3 },
    MURDER: { scored: 2, hits: 1, points: 2 },
    RECRUIT: { scored: 2, hits: 1, points: 1 },
  },
  byEpisode: [
    { ep: 1, points: 0 },
    { ep: 2, points },
    { ep: 3, points: 0 },
  ],
  winnerPoints: null,
});

export const ROUTES: Record<string, Route> = {
  "/users/me": () => ({ data: ME }),
  "/seasons/list": (_, __, url) => {
    const show = url.searchParams.get("show") ?? "dwts";
    return { data: { show, seasons: SEASONS[show] ?? [] } };
  },
  "/traitors/stats": (_, __, url) => ({ data: { season: url.searchParams.get("season"), ...traitorsStats(12) } }),
  "/stats/get": () => ({ data: { mine: { count: 14, mae: 0.87 } } }),
  "/leaderboard/get": () => ({ data: { minDances: 5, ranked: [{}, {}, {}, {}], me: { rank: 2 } }, meta: { ranked: 4 } }),
  "/friends/list": () => ({
    data: {
      inviteCode: "CODE42",
      friends: [{ ...person("u-1", "Alex Recliner"), at: null }],
      incoming: [{ ...person("u-2", "Sam Ottoman"), at: null }],
      outgoing: [],
      blocked: [],
    },
  }),
  "/groups/mine": () => ({
    data: [{ id: "g-1", name: "Couch Crew", inviteCode: "G1", members: [person("me-1", "Pat Couch"), person("u-1", "Alex Recliner")] }],
  }),
  "/notifications/list": () => ({ data: [INVITE], meta: { unread: 1, next: null } }),
  "/friends/accept": () => ({ data: { status: "friend" } }),
  "/groups/respond": () => ({ data: { id: "g-2", name: "Ballroom Bench", member: true } }),
  "/groups/create": (body) => ({ data: { id: "g-9", name: (body as { name: string }).name, inviteCode: "G9" } }),
};

/** Stubs fetch with ROUTES (plus overrides) and returns the mock to inspect calls. */
export function stubApi(overrides: Record<string, Route> = {}) {
  const routes = { ...ROUTES, ...overrides };
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url, "http://api.test");
    const path = parsed.pathname;
    const route = routes[path];
    if (!route) throw new Error(`No fake for ${path}`);
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
    const { data = null, meta = null, status = 200 } = route(body, init, parsed);
    const error = status >= 400 ? { handler: path, message: "Nope" } : null;
    return new Response(JSON.stringify({ data, meta, error }), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const calls = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => new URL(url, "http://api.test").pathname === path);
