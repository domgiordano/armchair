import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/api/prefetch");
const request = vi.hoisted(() => vi.fn(async (path: string) => ({ path })));
vi.mock("@armchair/app-core/api/client", () => ({ request }));

import { prefetchPage } from "./prefetch";

const paths = () => request.mock.calls.map(([path]) => path);

afterEach(() => {
  request.mockClear();
  localStorage.clear();
});

describe("prefetchPage", () => {
  it("starts your stats beside the season it would wait for", () => {
    prefetchPage("/stats/?season=dwts-35", "dwts-35");
    expect(paths()).toEqual(["/seasons/get?season=dwts-35", "/groups/mine", "/stats/me?season=dwts-35"]);
  });

  it("asks the overview for the same global board the leaderboard page does", () => {
    prefetchPage("/", "dwts-35");
    expect(paths()).toContain("/leaderboard/get?season=dwts-35&scope=global");
  });

  it("leaves a group board and an unpicked episode to the page", () => {
    prefetchPage("/leaderboard/?scope=group", "dwts-35");
    prefetchPage("/episode/", "dwts-35");
    expect(paths().some((p) => p.startsWith("/leaderboard/") || p.startsWith("/episodes/"))).toBe(false);
  });

  it("starts a named episode's state", () => {
    prefetchPage("/episode/?ep=5", "dwts-35");
    expect(paths()).toContain("/episodes/state?season=dwts-35&ep=05");
  });
});
