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

type Route = (body: unknown, init: RequestInit) => { data?: unknown; meta?: unknown; status?: number };

export const ROUTES: Record<string, Route> = {
  "/users/me": () => ({ data: ME }),
  "/seasons/list": () => ({ data: { show: "dwts", seasons: [{ id: "dwts-35", number: 35, year: 2026, current: true }] } }),
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
    const path = new URL(url, "http://api.test").pathname;
    const route = routes[path];
    if (!route) throw new Error(`No fake for ${path}`);
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
    const { data = null, meta = null, status = 200 } = route(body, init);
    const error = status >= 400 ? { handler: path, message: "Nope" } : null;
    return new Response(JSON.stringify({ data, meta, error }), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const calls = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => new URL(url, "http://api.test").pathname === path);
