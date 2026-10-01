import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";

import { StatsScreen } from "./stats-screen";
import { calls, stubApi } from "./test-api";

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

  it("offers a retry when the stats fail", async () => {
    stubApi({ "/stats/get": () => ({ status: 500 }), "/seasons/get": () => ({ data: { judges: [] } }) });
    render(<StatsScreen />);
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t load your stats");
  });
});
