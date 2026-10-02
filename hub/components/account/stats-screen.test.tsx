import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";

import { StatsScreen } from "./stats-screen";
import { calls, stubApi, traitorsStats } from "./test-api";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/amplify", () => ({ authConfigured: true }));

const STATS = {
  season: "dwts-35",
  mine: {
    count: 14,
    mae: 0.87,
    judges: { "judge-a": { count: 14, mae: 1.2 }, "judge-b": { count: 14, mae: 0.6 } },
  },
  episodes: [
    { ep: 1, count: 8, mae: 1.1, judges: {} },
    { ep: 2, count: 6, mae: 0.55, judges: {} },
  ],
};

const board = (rank: number | null, total: number, count = 14) => () => ({
  data: { minDances: 5, ranked: [], unranked: [], me: { sub: "me-1", name: "Pat Couch", picture: null, count, mae: 0.87, rank } },
  meta: { ranked: total, unranked: 0 },
});

describe("stats tab", () => {
  beforeEach(() => resetMe());

  it("shows the season snapshot, all-time numbers and both charts", async () => {
    const fetchMock = stubApi({
      "/stats/get": () => ({ data: STATS }),
      "/seasons/get": () => ({ data: { judges: [{ id: "judge-a", name: "Ana Judge" }, { id: "judge-b", name: "Bo Panel" }] } }),
      "/leaderboard/get": board(3, 40),
    });
    render(<StatsScreen />);

    const card = await screen.findByRole("region", { name: "Dancing with the Stars" });
    expect(within(card).getByText("Season 35 · 2026")).toBeTruthy();
    const figure = (label: string) => within(card).getByText(label).parentElement?.textContent;
    expect(figure("Accuracy")).toContain("0.87");
    expect(figure("Season rank")).toContain("#3");
    expect(figure("Season rank")).toContain("of 40");
    expect(figure("Closest judge")).toContain("Bo");

    const judges = screen.getByRole("region", { name: "Judge by judge" });
    expect(within(judges).getByRole("row", { name: "Bo Panel 0.60 off over 14" })).toBeTruthy();
    const weeks = screen.getByRole("region", { name: "Your episodes" });
    expect(within(weeks).getByRole("row", { name: "Episode 2 0.55 off" })).toBeTruthy();

    const seasons = calls(fetchMock, "/leaderboard/get").map(([url]) => new URL(url, "http://api.test").searchParams.get("season"));
    expect(seasons.sort()).toEqual(["all", "dwts-35"]);
  });

  it("says what is missing before the first score", async () => {
    stubApi({
      "/stats/get": () => ({ data: { season: "dwts-35", mine: { count: 0, mae: null, judges: {} }, episodes: [] } }),
      "/seasons/get": () => ({ data: { judges: [] } }),
      "/leaderboard/get": board(null, 0, 0),
    });
    render(<StatsScreen />);
    expect(await screen.findByText(/your gap to the judges shows up here/)).toBeTruthy();
    expect(screen.getAllByText("5 more dances to rank").length).toBeGreaterThan(0);
  });

  it("switches to Traitors US: points, rank, call by call and episodes, with DWTS untouched", async () => {
    const fetchMock = stubApi({
      "/stats/get": () => ({ data: STATS }),
      "/seasons/get": () => ({ data: { judges: [] } }),
      "/leaderboard/get": board(3, 40),
      "/traitors/ranks": () => ({
        data: { season: "tus-5", scope: "global", group: null, ranked: [], me: { sub: "me-1", rank: 4, points: 12, events: 6, banishHits: 1 } },
        meta: { ranked: 30 },
      }),
    });
    render(<StatsScreen />);
    await screen.findByRole("region", { name: "Dancing with the Stars" });

    const show = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(show).getByRole("button", { name: "Traitors US" }));
    expect(within(show).getByRole("button", { name: "Traitors US" }).getAttribute("aria-pressed")).toBe("true");

    const card = await screen.findByRole("region", { name: "The Traitors US" });
    expect(within(card).getByText("Season 5 · 2026")).toBeTruthy();
    const figure = (label: string) => within(card).getByText(label).parentElement?.textContent;
    expect(figure("Points")).toContain("12");
    expect(figure("Season rank")).toContain("#4");
    expect(figure("Season rank")).toContain("of 30");
    expect(figure("Winner bet")).toContain("Settles at the finale");
    expect(screen.queryByRole("region", { name: "Dancing with the Stars" })).toBeNull();

    const events = screen.getByRole("region", { name: "Call by call" });
    expect(within(events).getByRole("row", { name: "Round table 1 of 2 right, 9 points" })).toBeTruthy();
    // Episode 3 hasn't scored yet, so the chart stops at episode 2.
    const episodes = screen.getByRole("region", { name: "Your episodes" });
    expect(within(episodes).getAllByRole("row").map((r) => r.textContent)).toEqual(["EpisodePoints", "Episode 10 points", "Episode 212 points"]);

    const url = new URL(calls(fetchMock, "/traitors/ranks")[0][0], "http://api.test").searchParams;
    expect([url.get("season"), url.get("show"), url.get("scope")]).toEqual(["tus-5", "tus", "global"]);
    expect(screen.getByRole("link", { name: "Every pick in The Traitors app" }).getAttribute("href")).toBe(
      "https://traitors.armchairjudge.com/?sso=1",
    );
  });

  it("shows each current UK season under Traitors UK", async () => {
    const fetchMock = stubApi({
      "/traitors/stats": () => ({ data: { ...traitorsStats(0), events: 0, banishHits: 0 } }),
      "/traitors/ranks": () => ({ data: { ranked: [], me: { sub: "me-1", rank: 1, points: 0, events: 0, banishHits: 0 } }, meta: { ranked: 1 } }),
    });
    render(<StatsScreen />);
    fireEvent.click(within(await screen.findByRole("group", { name: "Show" })).getByRole("button", { name: "Traitors UK" }));

    const card = await screen.findByRole("region", { name: "The Traitors Celebrity UK" });
    expect(within(card).getByText("Season rank").parentElement?.textContent).toContain("Ranks after your first call");
    expect(screen.getByText(/your points show up here/)).toBeTruthy();
    // tuk-4 isn't current, so only the celebrity season is asked for.
    const shows = calls(fetchMock, "/seasons/list").map(([u]) => new URL(u, "http://api.test").searchParams.get("show"));
    expect(shows).toContain("tuk");
    expect(calls(fetchMock, "/traitors/stats").map(([u]) => new URL(u, "http://api.test").searchParams.get("season"))).toEqual(["tukc-2"]);
  });

  it("offers a retry when the stats fail", async () => {
    stubApi({ "/stats/get": () => ({ status: 500 }), "/seasons/get": () => ({ data: { judges: [] } }) });
    render(<StatsScreen />);
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t load your stats");
  });
});
