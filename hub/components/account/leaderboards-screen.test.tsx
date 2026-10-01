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
vi.mock("@/lib/auth/amplify", () => ({ authConfigured: true }));

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
    const alex = await screen.findByRole("link", { name: /Alex Recliner/ });
    expect(alex.getAttribute("href")).toBe("https://dwts.armchairjudge.com/profile/?u=u-1&sso=1");
    expect(screen.getByRole("link", { name: /Pat Couch/ }).closest("li")?.textContent).toContain("7");
    expect(screen.getByText(/Showing the top 2 of 7/)).toBeTruthy();
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
