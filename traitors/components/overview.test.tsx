import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getRanks: vi.fn(), getEpisode: vi.fn() }));
vi.mock("@/lib/api/traitors", () => api);
vi.mock("@/lib/api/history", () => ({ getPlayer: () => new Promise(() => {}) }));
vi.mock("@/components/season-provider", () => ({
  useSeasonName: () => ({ title: "New Blood", eyebrow: "US · Season 5", numbered: "Season 5" }),
}));

import type { SeasonView } from "@/lib/api/traitors";

import { BetProvider } from "./bet";
import { Overview } from "./overview";
import { SeasonDataContext } from "./season-data";

const DAY = 86_400_000;
const now = Date.now();

const VIEW: SeasonView = {
  season: "tus-5",
  title: "The Traitors: New Blood",
  current: true,
  needsBet: false,
  bet: { picks: [{ player: "ava-stone", faction: "Traitor", released: 0 }], released: 0 },
  summary: null,
  episodes: [1, 2, 3, 4].map((ep) => ({
    ep,
    title: null,
    releaseAt: new Date(now + (ep - 2.5) * DAY).toISOString(),
    closed: ep <= 2,
    events: 3,
    answered: 0,
  })),
  cast: [
    { id: "ava-stone", name: "Ava Stone", headshot: null, faction: null, exit: null },
    { id: "ben-hart", name: "Ben Hart", headshot: null, faction: "Traitor", exit: { ep: 2, how: "banished" } },
    { id: "cal-reyes", name: "Cal Reyes", headshot: null, faction: "Faithful", exit: { ep: 1, how: "banished" } },
    { id: "dee-moss", name: "Dee Moss", headshot: null, faction: null, exit: { ep: 2, how: "murdered" } },
  ],
};

it("shows how far in the season is, the Traitors caught so far and the cast wall", async () => {
  const me = { rank: 4, sub: "me", name: "Me", picture: null, points: 12, events: 6, banishHits: 1, average: 2 };
  api.getRanks.mockResolvedValue({ season: "tus-5", scope: "global", group: null, ranked: [me], me });
  api.getEpisode.mockReturnValue(new Promise(() => {}));
  render(
    <SeasonDataContext value={{ view: VIEW, reload: vi.fn() }}>
      <Overview />
    </SeasonDataContext>,
  );

  expect(screen.getByRole("heading", { level: 1, name: "New Blood" })).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Episodes out" }).getAttribute("aria-valuenow")).toBe("2");
  expect((await screen.findByText(/^Rank/)).textContent).toBe("Rank 4");

  // Only a revealed Traitor: the murdered player's side isn't known, the banished Faithful isn't one.
  const caught = within(screen.getByRole("region", { name: "Traitors unmasked" }));
  expect(caught.getAllByRole("listitem")).toHaveLength(1);
  expect(caught.getByRole("link", { name: "Ben Hart" }).getAttribute("href")).toMatch(/id=ben-hart&season=tus-5/);

  const wall = within(screen.getByRole("group", { name: "The cast at the table" }));
  expect(wall.getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
    "Ava Stone",
    "Ben Hart, Traitor, Banished ep 2",
    "Dee Moss, Murdered ep 2",
    "Cal Reyes, Faithful, Banished ep 1",
  ]);
  // Your bet names link too.
  expect(screen.getAllByRole("link", { name: "Ava Stone" })).toHaveLength(2);
});

it("leads with the latest unlocked episode's recap, then earlier ones, sealed where calls are still owed", async () => {
  const long = `Ben was banished. ${"The castle argued long into the night. ".repeat(20)}`;
  const recaps: Record<number, string> = { 1: "Cal walked in first.", 3: long };
  vi.clearAllMocks();
  api.getRanks.mockReturnValue(new Promise(() => {}));
  api.getEpisode.mockImplementation(async (_season: string, ep: number) => ({
    season: "tus-5",
    ep,
    title: null,
    releaseAt: "",
    closed: false,
    roster: [],
    out: [],
    needsBet: false,
    events: [{ type: "RT", picks: 3, locked: false, mine: { forfeit: true, submittedAt: "" }, result: { banished: "ben-hart" } }],
    recap: { text: recaps[ep], source: "wikipedia", sourceUrl: `https://en.wikipedia.org/wiki/Ep${ep}` },
  }));
  const episodes = [3, 0, 3, 0].map((answered, i) => ({
    ...VIEW.episodes[i],
    releaseAt: new Date(now - (4 - i) * DAY).toISOString(),
    closed: false,
    answered,
  }));
  render(
    <SeasonDataContext value={{ view: { ...VIEW, episodes }, reload: vi.fn() }}>
      <Overview />
    </SeasonDataContext>,
  );

  const latest = within(screen.getByRole("region", { name: "Latest in the castle" }));
  expect((await latest.findByText(/^Ben was banished/)).textContent).toMatch(/…$/);
  expect(latest.getByRole("link", { name: "From Wikipedia" }).getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Ep3");
  expect(latest.getByRole("link", { name: "Open the episode" }).getAttribute("href")).toMatch(/ep=3/);

  const earlier = within(screen.getByRole("region", { name: "Previously on" }));
  const rows = earlier.getAllByRole("listitem");
  expect(rows.map((li) => within(li).getByRole("heading").textContent)).toEqual([
    "Episode 4",
    "Episode 2",
    "Episode 1",
  ]);
  // Episodes 2 and 4 still owe calls: no read, no recap, a way to go make them.
  expect(within(rows[0]).getByRole("link", { name: "Make your calls" }).getAttribute("href")).toMatch(/ep=4/);
  expect(within(rows[1]).getByText("Make your calls to unseal the recap.")).toBeTruthy();
  expect(await within(rows[2]).findByText("Cal walked in first.")).toBeTruthy();
  expect(api.getEpisode.mock.calls.map((c) => c[1]).sort()).toEqual([1, 3]);
});

it("shows your ranked winner picks and offers the next empty place", () => {
  api.getRanks.mockReturnValue(new Promise(() => {}));
  api.getEpisode.mockReturnValue(new Promise(() => {}));
  const view: SeasonView = {
    ...VIEW,
    bet: {
      picks: [
        { player: "ava-stone", faction: "Traitor", released: 0 },
        { player: "dee-moss", faction: "Faithful", released: 2 },
      ],
      released: 0,
    },
    betRoster: VIEW.cast,
  };
  render(
    <SeasonDataContext value={{ view, reload: vi.fn() }}>
      <BetProvider view={view} onSealed={vi.fn()}>
        <Overview />
      </BetProvider>
    </SeasonDataContext>,
  );
  const card = within(screen.getByRole("region", { name: "Your winner picks" }));
  const places = card.getAllByRole("listitem");
  expect(places[0].textContent).toMatch(/Ava Stone.*as a Traitor.*up to 30 pts/);
  // 2nd was sealed with two of four episodes out.
  expect(places[1].textContent).toMatch(/Dee Moss.*as a Faithful.*up to 9 pts/);
  expect(places[2].textContent).toMatch(/3rd choice is empty/);
  expect(card.getByRole("button", { name: "Add your 3rd choice" })).toBeTruthy();
  // No nag banner once a 1st is sealed.
  expect(screen.queryByRole("complementary", { name: "Winner bet" })).toBeNull();
});

it("shows what you picked in each episode summary", () => {
  api.getRanks.mockReturnValue(new Promise(() => {}));
  api.getEpisode.mockReturnValue(new Promise(() => {}));
  const episodes = VIEW.episodes.map((e) => ({
    ...e,
    releaseAt: new Date(now - (5 - e.ep) * DAY).toISOString(),
    closed: false,
    answered: 3,
    mine: e.ep === 4 ? { MURDER: { picks: ["dee-moss"] }, RT: { picks: ["ben-hart", "ava-stone", "cal-reyes"] }, RECRUIT: { forfeit: true } } : {},
  }));
  render(
    <SeasonDataContext value={{ view: { ...VIEW, episodes }, reload: vi.fn() }}>
      <Overview />
    </SeasonDataContext>,
  );
  const latest = within(screen.getByRole("region", { name: "Latest in the castle" }));
  expect(latest.getByText("You picked").parentElement?.textContent).toMatch(
    /^You pickedMurder.*Dee.*Banish.*I.*Ben.*II.*Ava.*III.*Cal.*Recruitno pick$/,
  );
});
