import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getRecord: vi.fn(), FRIENDS: "friends" }));
vi.mock("@/lib/api/traitors", () => api);
vi.mock("@/lib/api/history", () => ({ getPlayer: () => new Promise(() => {}) }));
vi.mock("@armchair/app-core/api/groups", () => ({ getMyGroups: vi.fn(async () => []) }));
vi.mock("@/components/season-provider", () => ({
  useSeasonName: () => ({ title: "New Blood", eyebrow: "US · Season 5", numbered: "Season 5" }),
}));

import type { PersonRecord, SeasonView } from "@/lib/api/traitors";
import { sealCall } from "@/lib/sealed";

import { PicksScreen } from "./picks-screen";
import { SeasonDataContext } from "./season-data";

const VIEW: SeasonView = {
  season: "tus-5",
  title: "New Blood",
  current: true,
  needsBet: false,
  bet: null,
  summary: null,
  cast: [],
  episodes: [1, 2, 3].map((ep) => ({ ep, title: null, releaseAt: "2026-09-01T00:00:00Z", closed: false, events: 3, answered: 3 })),
};

const rt = (ep: number, picks: string[], points: number) => ({
  ep,
  type: "RT" as const,
  picks,
  forfeit: false,
  points,
  calls: picks.map((player, i) => ({ player, points: i === 0 ? points : 0, why: i === 0 && points ? ("banished" as const) : ("miss" as const) })),
});

const PEOPLE: PersonRecord[] = [
  { sub: "u1", name: "Ada", picture: null, me: true, winner: null, calls: [rt(2, ["ben", "cal", "dee"], 5), rt(3, ["eli", "fay", "gus"], 5)] },
  { sub: "u2", name: "Bea", picture: null, me: false, winner: null, calls: [rt(2, ["cal", "ben", "dee"], 0), rt(3, ["eli", "gus", "fay"], 5)] },
];

const renderScreen = () =>
  render(
    <SeasonDataContext value={{ view: VIEW, reload: vi.fn() }}>
      <PicksScreen />
    </SeasonDataContext>,
  );

beforeEach(() => {
  localStorage.clear();
  api.getRecord.mockResolvedValue({ season: "tus-5", people: PEOPLE });
});

it("compares friends and opens one person's season with head to head", async () => {
  renderScreen();
  const table = within(await screen.findByRole("table", { name: "Points and accuracy for each person" }));
  expect(table.getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([
    expect.stringMatching(/^AYou10100%/),
    expect.stringMatching(/^BBea550%.*1-0-1$/),
  ]);
  fireEvent.click(table.getByRole("button", { name: /Bea/ }));
  expect((await screen.findByRole("region", { name: "You against Bea" })).textContent).toMatch(/won 1, lost 0, tied 1 of 2 calls, \+5/);
  expect(api.getRecord).toHaveBeenCalledWith("tus-5", "friends");
});

it("keeps a face-down episode to your own picks, with no points and nobody else's calls", async () => {
  sealCall("tus-5", 3, "RT");
  renderScreen();
  const table = within(await screen.findByRole("table", { name: "Points and accuracy for each person" }));
  // Episode 3 is out of both totals.
  expect(table.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["5", "0"]);
  const timeline = within(screen.getByRole("region", { name: /Who you chose/ }));
  const ep3 = timeline.getAllByRole("listitem")[0];
  expect(ep3.textContent).toMatch(/^Episode 3/);
  expect(ep3.textContent).not.toMatch(/\+/);
});
