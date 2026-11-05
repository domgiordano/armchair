import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getStats: vi.fn(),
  getCrowdStats: vi.fn(),
  FRIENDS: "friends",
}));
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
const groups = vi.hoisted(() => ({ getMyGroups: vi.fn(), plays: () => true }));
vi.mock("@/lib/api/traitors", () => api);
vi.mock("@armchair/app-core/api/groups", () => groups);
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/components/season-provider", () => ({
  useSeasonName: () => ({ title: "Season 5", eyebrow: "US", numbered: null }),
}));

import type { CrowdStats, SeasonView } from "@/lib/api/traitors";

import { SeasonDataContext } from "./season-data";
import { StatsScreen } from "./stats-screen";

const VIEW: SeasonView = {
  season: "tus-5",
  title: "",
  current: true,
  needsBet: false,
  bet: null,
  summary: null,
  cast: [
    { id: "bob", name: "Bob Ray", headshot: null, faction: null, exit: null },
    { id: "cat", name: "Cat Fox", headshot: null, faction: null, exit: null },
  ],
  episodes: [],
};

const CROWD: CrowdStats = {
  season: "tus-5",
  scope: "global",
  group: null,
  episodes: [
    {
      ep: 2,
      title: "Daggers",
      calls: {
        RT: { voters: 4, hits: 1, banished: "bob", top: "cat", topVotes: 3 },
        MURDER: { voters: 4, hits: 3 },
      },
    },
  ],
  byEvent: {
    RT: { scored: 4, hits: 1 },
    MURDER: { scored: 4, hits: 3 },
    RECRUIT: { scored: 0, hits: 0 },
  },
  mine: {
    RT: { scored: 1, hits: 1 },
    MURDER: { scored: 1, hits: 0 },
    RECRUIT: { scored: 0, hits: 0 },
  },
  leaders: [{ rank: 1, sub: "a", name: "Ann", picture: null, points: 12 }],
  me: { rank: 3, points: 5 },
  ranked: 4,
};

const wrap = () =>
  render(
    <SeasonDataContext value={{ view: VIEW, reload: vi.fn() }}>
      <StatsScreen />
    </SeasonDataContext>,
  );

beforeEach(() => {
  localStorage.clear();
  nav.search = "";
  api.getCrowdStats.mockResolvedValue(CROWD);
  api.getStats.mockReturnValue(new Promise(() => {}));
  groups.getMyGroups.mockResolvedValue([]);
});
afterEach(() => vi.clearAllMocks());

it("puts the tab in the query string", () => {
  wrap();
  expect(
    screen.getByRole("tab", { name: "You" }).getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
  expect(nav.replace).toHaveBeenCalledWith("/stats/?view=compare", {
    scroll: false,
  });
});

it("sets the crowd's calls beside yours", async () => {
  nav.search = "view=global";
  wrap();
  expect(await screen.findByText("You vs Everyone")).toBeTruthy();
  expect(api.getCrowdStats).toHaveBeenCalledWith("tus-5", null);
  expect(
    screen.getByText(/had Bob Ray first\. Most picked Cat Fox/),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("list", { name: "Leaders" })).getByText("Ann"),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("list", { name: "Hardest calls" })).getByText(
      /Round table/,
    ),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("list", { name: "Easiest calls" })).getByText(
      /Murders/,
    ),
  ).toBeTruthy();
});

it("compares with everyone, and points a caller with no group at one", async () => {
  nav.search = "view=groups";
  wrap();
  expect(await screen.findByText("You vs Everyone")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Start one or join one" }),
  ).toBeTruthy();
  expect(api.getCrowdStats).toHaveBeenCalledWith("tus-5", null);
});

it("reads a group's stats for a member, and goes back to everyone in one tap", async () => {
  nav.search = "view=compare&group=g1";
  groups.getMyGroups.mockResolvedValue([
    { id: "g1", name: "Castle", members: ["a", "b"] },
  ]);
  wrap();
  expect(await screen.findByText("You vs Castle")).toBeTruthy();
  expect(api.getCrowdStats).toHaveBeenCalledWith("tus-5", "g1");
});

it("lets the control take over from a ?group= link", async () => {
  nav.search = "view=compare&group=g1";
  groups.getMyGroups.mockResolvedValue([{ id: "g1", name: "Castle", members: ["a", "b"] }]);
  wrap();
  await screen.findByText("You vs Castle");
  fireEvent.click(screen.getByRole("button", { name: "Show Everyone" }));
  expect(nav.replace).toHaveBeenCalledWith("/stats/?view=compare", { scroll: false });
  expect(localStorage.getItem("armchair.group")).toBeNull();
});
