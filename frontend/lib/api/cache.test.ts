import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { clearCache } from "./cache";
import { request } from "./client";

const realFetch = globalThis.fetch;
let served = 0;
const fetchMock = vi.fn(async () => {
  served += 1;
  return new Response(JSON.stringify({ data: { n: served }, error: null, meta: null }));
});

const signedIn = (sub: string) =>
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "t", payload: { sub } } } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  served = 0;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  signedIn("u1");
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
  fetchMock.mockClear();
});

const get = (path: string) => request<{ n: number }>(path);
const post = (path: string) => request<{ n: number }>(path, { method: "POST", body: "{}" });

describe("API read cache", () => {
  it("answers a fresh read from memory", async () => {
    expect(await get("/overview/get?season=dwts-35")).toEqual({ n: 1 });
    vi.advanceTimersByTime(29_000);
    expect(await get("/overview/get?season=dwts-35")).toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves a stale read at once and refreshes it for next time", async () => {
    await get("/stats/get?season=dwts-35");
    vi.advanceTimersByTime(60_000);
    expect(await get("/stats/get?season=dwts-35")).toEqual({ n: 1 });
    await vi.waitFor(async () => expect(await get("/stats/get?season=dwts-35")).toEqual({ n: 2 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits for the network once an entry is too old to serve", async () => {
    await get("/stats/get?season=dwts-35");
    vi.advanceTimersByTime(11 * 60_000);
    expect(await get("/stats/get?season=dwts-35")).toEqual({ n: 2 });
  });

  it("shares one request between identical reads in flight", async () => {
    const [a, b] = await Promise.all([get("/friends/list"), get("/friends/list")]);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never serves an episode's state stale, and never caches notifications", async () => {
    await get("/episodes/state?season=dwts-35&ep=05");
    vi.advanceTimersByTime(6_000);
    expect(await get("/episodes/state?season=dwts-35&ep=05")).toEqual({ n: 2 });
    await get("/notifications/list?limit=50");
    expect(await get("/notifications/list?limit=50")).toEqual({ n: 4 });
  });

  it("forgets everything but the season catalog after a write", async () => {
    await get("/seasons/get?season=dwts-35");
    await get("/overview/get?season=dwts-35");
    await post("/scores/submit");
    expect(await get("/seasons/get?season=dwts-35")).toEqual({ n: 1 });
    expect(await get("/overview/get?season=dwts-35")).toEqual({ n: 4 });
  });

  it("doesn't store a read that was in flight when a write landed", async () => {
    const before = get("/overview/get?season=dwts-35");
    await post("/scores/submit");
    await before;
    await get("/overview/get?season=dwts-35");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps each person's reads apart, and in sessionStorage until sign-out", async () => {
    await get("/friends/list");
    expect(Object.keys(sessionStorage).some((k) => k.endsWith("u1:/friends/list"))).toBe(true);
    signedIn("u2");
    expect(await get("/friends/list")).toEqual({ n: 2 });
    clearCache();
    expect(Object.keys(sessionStorage).filter((k) => k.startsWith("armchair.api:"))).toEqual([]);
  });
});
