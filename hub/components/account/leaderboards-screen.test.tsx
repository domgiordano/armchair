import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";

import { LeaderboardsScreen } from "./leaderboards-screen";
import { calls, stubApi } from "./test-api";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: true }));

const who = (sub: string, name: string, rank: number, mae: number) => ({ sub, name, picture: null, count: 9, mae, rank });

const ME = { sub: "me-1", name: "Pat Couch", picture: null, count: 9, mae: 1.4, rank: 7 };

describe("leaderboards tab", () => {
  beforeEach(() => resetMe());

  it("ranks everyone this season, and keeps you on the board when you're further down", async () => {
    stubApi({
      "/leaderboard/get": () => ({
        data: { minDances: 5, ranked: [who("u-1", "Alex Recliner", 1, 0.4), who("u-2", "Sam Ottoman", 2, 0.6)], unranked: [], me: ME },
        meta: { ranked: 7, unranked: 0 },
      }),
    });
    render(<LeaderboardsScreen />);
    // Seasons, then the board: two fetch rounds on a cold first render ran past
    // findBy's 1s default on CI runners (1.35s, three runs in a row).
    const alex = await screen.findByRole("link", { name: /Alex Recliner/ }, { timeout: 5000 });
    expect(alex.getAttribute("href")).toBe("https://dwts.armchairjudge.com/profile/?u=u-1&sso=1");
    expect(screen.getByRole("link", { name: /Pat Couch/ }).closest("li")?.textContent).toContain("7");
    expect(screen.getByText(/Showing the top 2 of 7/)).toBeTruthy();
  });

  it("switches to the Traitors board, ranked by points, and to all-time for that edition", async () => {
    const pts = (sub: string, name: string, rank: number, points: number) => ({
      sub, name, picture: null, avatarKind: "initials", rank, points, events: 6, banishHits: 2, average: points / 6,
    });
    const fetchMock = stubApi({
      "/leaderboard/get": () => ({ data: { minDances: 5, ranked: [ME], unranked: [], me: ME }, meta: { ranked: 1 } }),
      "/traitors/ranks": () => ({
        data: {
          season: "tus-5",
          scope: "global",
          group: null,
          ranked: [pts("u-1", "Alex Recliner", 1, 24), pts("me-1", "Pat Couch", 2, 18)],
          me: pts("me-1", "Pat Couch", 2, 18),
        },
        meta: { ranked: 2 },
      }),
    });
    render(<LeaderboardsScreen />);
    fireEvent.click(within(await screen.findByRole("group", { name: "Show" })).getByRole("button", { name: "Traitors US" }));

    const alex = await screen.findByRole("link", { name: /Alex Recliner/ }, { timeout: 5000 });
    expect(alex.closest("li")?.textContent).toContain("24pts");
    expect(alex.textContent).toContain("6 calls · 2 banishments");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Sharpest at the table.");

    const season = screen.getByRole("group", { name: "Season" });
    expect(within(season).getByRole("button", { name: "US · Season 5" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(season).getByRole("button", { name: "All-time" }));
    await waitFor(() => expect(calls(fetchMock, "/traitors/ranks")).toHaveLength(2));
    const last = new URL(calls(fetchMock, "/traitors/ranks")[1][0], "http://api.test").searchParams;
    expect([last.get("season"), last.get("show"), last.get("scope")]).toEqual(["all", "tus", "global"]);
    expect(calls(fetchMock, "/leaderboard/get")).toHaveLength(0);
  });

  it("says when nobody has a Traitors call scored yet", async () => {
    stubApi({
      "/traitors/ranks": () => ({
        data: { ranked: [{ ...ME, avatarKind: "initials", rank: 1, points: 0, events: 0, banishHits: 0, average: null }], me: { ...ME, rank: 1, points: 0, events: 0, banishHits: 0 } },
        meta: { ranked: 1 },
      }),
    });
    render(<LeaderboardsScreen />);
    fireEvent.click(within(await screen.findByRole("group", { name: "Show" })).getByRole("button", { name: "Traitors UK" }));
    expect(await screen.findByText(/No calls are scored yet/)).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Season" })).getByRole("button", { name: "Celebrity UK · Season 2" })).toBeTruthy();
  });

  it("switches to all-time and to friends", async () => {
    const fetchMock = stubApi({
      "/leaderboard/get": () => ({ data: { minDances: 5, ranked: [ME], unranked: [], me: ME }, meta: { ranked: 1 } }),
    });
    render(<LeaderboardsScreen />);
    const season = await screen.findByRole("group", { name: "Season" });
    fireEvent.click(within(season).getByRole("button", { name: "All-time" }));
    await waitFor(() => expect(calls(fetchMock, "/leaderboard/get")).toHaveLength(2));
    fireEvent.click(within(screen.getByRole("group", { name: "Who" })).getByRole("button", { name: "Friends" }));
    await waitFor(() => expect(calls(fetchMock, "/leaderboard/get")).toHaveLength(3));

    const last = new URL(calls(fetchMock, "/leaderboard/get")[2][0], "http://api.test").searchParams;
    expect([last.get("season"), last.get("scope")]).toEqual(["all", "friends"]);
    expect(await screen.findByText(/No friends to rank against yet/)).toBeTruthy();
  });
});
