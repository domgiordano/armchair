import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getRanks: vi.fn(), getStats: vi.fn(), getEpisode: vi.fn() }));
vi.mock("@/lib/api/traitors", () => api);
vi.mock("@armchair/app-core/api/groups", () => ({ getMyGroups: vi.fn(async () => []) }));
vi.mock("@/components/season-provider", () => ({
  useShellSeason: () => ({ seasons: [{ id: "tus-5", number: 5, year: 2026, current: true }] }),
  useSeasonName: () => ({ title: "Season 5", eyebrow: "US", numbered: null }),
}));

import type { SeasonView, Standing } from "@/lib/api/traitors";

import { LeaderboardScreen } from "./leaderboard-screen";
import { PlayersScreen } from "./players-screen";
import { SeasonDataContext } from "./season-data";
import { StatsScreen } from "./stats-screen";

const VIEW: SeasonView = {
  season: "tus-5",
  title: "",
  current: true,
  needsBet: false,
  bet: null,
  summary: null,
  cast: [],
  episodes: [1, 2, 3].map((ep) => ({ ep, title: null, releaseAt: "2026-10-01T00:00:00Z", closed: false, events: 3, answered: 3 })),
};
const wrap = (ui: ReactNode) =>
  render(<SeasonDataContext value={{ view: VIEW, reload: vi.fn() }}>{ui}</SeasonDataContext>);

const standing = (rank: number, name: string, points: number): Standing => ({
  rank,
  sub: name.toLowerCase(),
  name,
  picture: null,
  points,
  events: 6,
  banishHits: 2,
  average: points / 6,
});
const RANKED = [standing(1, "Ann", 40), standing(2, "Bo", 31), standing(3, "Cy", 22), standing(4, "Me", 18), standing(5, "Di", 9)];

beforeEach(() => {
  localStorage.clear();
  api.getRanks.mockResolvedValue({ season: "tus-5", scope: "global", group: null, ranked: RANKED, me: RANKED[3] });
});
afterEach(() => vi.clearAllMocks());

it("puts the top three in the pot and marks your own row", async () => {
  wrap(<LeaderboardScreen />);
  const pot = within(await screen.findByRole("list", { name: "Top three" }));
  expect(pot.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    expect.stringContaining("Bo"),
    expect.stringContaining("Ann"),
    expect.stringContaining("Cy"),
  ]);
  const rest = within(screen.getByRole("list", { name: "Everyone else" }));
  expect(rest.getByText("You · Me").closest("li")?.getAttribute("aria-current")).toBe("true");
  // Five people fit on screen: no pinned copy.
  expect(screen.queryByRole("list", { name: "Your place" })).toBeNull();
  expect(api.getRanks).toHaveBeenCalledWith("tus-5", "tus", "global", null);
});

it("ranks friends and all-time for this edition", async () => {
  wrap(<LeaderboardScreen />);
  await screen.findByRole("list", { name: "Top three" });
  fireEvent.click(screen.getByRole("tab", { name: "Friends" }));
  await vi.waitFor(() => expect(api.getRanks).toHaveBeenLastCalledWith("tus-5", "tus", "friends", null));
  fireEvent.click(screen.getByRole("combobox", { name: "Standings for" }));
  fireEvent.click(screen.getByRole("option", { name: "All-time" }));
  await vi.waitFor(() => expect(api.getRanks).toHaveBeenLastCalledWith("all", "tus", "friends", null));
});

it("asks for a group before ranking one", async () => {
  wrap(<LeaderboardScreen />);
  fireEvent.click(await screen.findByRole("tab", { name: "Group" }));
  expect(await screen.findByText("You're not in a group yet")).toBeTruthy();
});

it("shows hit rates per call and points by episode", async () => {
  api.getStats.mockResolvedValue({
    season: "tus-5",
    points: 37,
    events: 7,
    banishHits: 2,
    byEvent: {
      RT: { scored: 3, hits: 3, points: 29 },
      MURDER: { scored: 3, hits: 1, points: 4 },
      RECRUIT: { scored: 1, hits: 1, points: 4 },
    },
    byEpisode: [
      { ep: 1, points: 0 },
      { ep: 2, points: 23 },
      { ep: 3, points: 14 },
    ],
    winnerPoints: null,
  });
  wrap(<StatsScreen />);
  expect(await screen.findByText("Murders")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Points by episode: episode 1 0, episode 2 23, episode 3 14" })).toBeTruthy();
});

it("walls the cast, crossing off only those the season says are out, each linked to their page", async () => {
  const cast = [
    { id: "ava-stone", name: "Ava Stone", headshot: null, faction: null, exit: null },
    { id: "ben-hart", name: "Ben Hart", headshot: null, faction: "Traitor" as const, exit: { ep: 2, how: "banished" } },
  ];
  render(<SeasonDataContext value={{ view: { ...VIEW, cast }, reload: vi.fn() }}><PlayersScreen /></SeasonDataContext>);
  const ben = screen.getByRole("link", { name: "Ben Hart, Traitor, Banished ep 2" });
  expect(ben.getAttribute("href")).toMatch(/show=tus&id=ben-hart&season=tus-5/);
  expect(ben.querySelector("[data-out=banished]")).toBeTruthy();
  const ava = screen.getByRole("link", { name: "Ava Stone" });
  expect(ava.querySelector("[data-out]")).toBeNull();
  expect(api.getEpisode).not.toHaveBeenCalled();
});

it("pins your row when you're outside the list", async () => {
  const me = standing(140, "Me", 1);
  api.getRanks.mockResolvedValue({ season: "tus-5", scope: "global", group: null, ranked: RANKED.slice(0, 3), me });
  wrap(<LeaderboardScreen />);
  const mine = within(await screen.findByRole("list", { name: "Your place" }));
  expect(mine.getByText("140")).toBeTruthy();
});
