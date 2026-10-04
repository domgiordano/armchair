import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));
const api = vi.hoisted(() => ({ getPlayer: vi.fn(), searchPlayers: vi.fn(), SEARCH_MIN: 2 }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.search) }));
vi.mock("@/lib/api/history", () => api);
vi.mock("@/components/season-provider", () => ({ useShellSeason: () => ({ edition: "uk", season: "tukc-2" }) }));

import type { PlayerProfile, StoryEpisode } from "@/lib/api/history";
import { spoken } from "@/test/spoken";

import { PlayerScreen } from "./player-screen";
import { PlayerSearch } from "./player-search";

const PROFILE: PlayerProfile = {
  id: "ann-avery",
  name: "Ann Avery",
  headshot: null,
  bio: { text: "Ann Avery is a nurse from Ohio.", sourceUrl: "https://en.wikipedia.org/wiki/Ann_Avery" },
  seasons: [
    {
      season: "tus-2",
      number: 2,
      current: false,
      finish: { how: "banished", ep: 4 },
      faction: "Traitor",
      votes: [
        { ep: 2, received: 0 },
        { ep: 3, received: 2 },
        { ep: 4, received: 7 },
      ],
      championship: false,
    },
    {
      season: "tus-1",
      number: 1,
      current: false,
      finish: { how: "winner", ep: 9 },
      faction: "Faithful",
      votes: [],
      championship: true,
    },
    { season: "tus-5", number: 5, current: true, finish: null, faction: null, votes: null, championship: false },
  ],
};

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.open = false;
};

beforeEach(() => {
  nav.search = "show=tus&id=ann-avery";
});
afterEach(() => vi.clearAllMocks());

it("lists every season played, newest first, with a votes chart for past ones", async () => {
  api.getPlayer.mockResolvedValue(PROFILE);
  render(<PlayerScreen />);

  expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Ann Avery");
  expect(api.getPlayer).toHaveBeenCalledWith("tus", "ann-avery");
  const seasons = within(screen.getByRole("list", { name: "Seasons played" })).getAllByRole("listitem");
  expect(seasons.map((li) => li.getAttribute("aria-label"))).toEqual(["Season 5", "Season 2", "Season 1"]);

  const live = within(seasons[0]);
  expect(live.getByText("Still in the castle")).toBeTruthy();
  expect(live.getByText("Live now")).toBeTruthy();
  expect(live.queryByRole("img")).toBeNull();

  const past = within(seasons[1]);
  expect(past.getByText("Traitor")).toBeTruthy();
  expect(past.getByText("Banished ep 4")).toBeTruthy();
  expect(past.getByRole("img", { name: "Votes received: episode 2, 0; episode 3, 2; episode 4, 7" })).toBeTruthy();
  expect(past.getByRole("link", { name: "Season 2" }).getAttribute("href")).toMatch(/^\/\?season=tus-2$/);
});

it("says so when the link names no player", () => {
  nav.search = "show=dwts&id=ann-avery";
  render(<PlayerScreen />);
  expect(screen.getByText("No such player")).toBeTruthy();
  expect(api.getPlayer).not.toHaveBeenCalled();
});

it("retries a failed load", async () => {
  api.getPlayer.mockRejectedValueOnce(new Error("No such player")).mockResolvedValueOnce(PROFILE);
  render(<PlayerScreen />);
  expect((await screen.findByRole("alert")).textContent).toContain("No such player");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Ann Avery" })).toBeTruthy();
});

it("searches every edition from the header, this one first, and links each player to their page", async () => {
  api.searchPlayers.mockImplementation(async (show: string) =>
    show === "tukc"
      ? [{ id: "ann-avery", name: "Ann Avery", headshot: null, seasons: [1, 2] }]
      : show === "tus"
        ? [{ id: "anna-bly", name: "Anna Bly", headshot: null, seasons: [3] }]
        : [],
  );
  render(<PlayerSearch />);
  fireEvent.click(screen.getByRole("button", { name: "Search players" }));
  const box = screen.getByRole("searchbox", { name: "Search players" });
  fireEvent.change(box, { target: { value: "a" } });
  expect(screen.getByRole("status").textContent).toBe("Type at least 2 letters of a name.");

  fireEvent.change(box, { target: { value: "ann" } });
  const hit = await screen.findByRole("link", { name: /Ann Avery/ });
  expect(api.searchPlayers.mock.calls).toEqual([
    ["tukc", "ann"],
    ["tuk", "ann"],
    ["tus", "ann"],
  ]);
  expect(hit.textContent).toContain("UK · Celebrity series 1 and 2");
  expect(hit.getAttribute("href")).toMatch(/^\/players\/player\/?\?show=tukc&id=ann-avery&season=tukc-2$/);
  const us = screen.getByRole("link", { name: /Anna Bly/ });
  expect(us.textContent).toContain("US · Season 3");
  expect(us.getAttribute("href")).toMatch(/show=tus&id=anna-bly/);
});

it("tells each episode: who they voted for, the votes against them, a shield, and how they left", async () => {
  const at = (ep: number, rest: Partial<StoryEpisode>): StoryEpisode => ({
    season: "tus-2",
    ep,
    title: null,
    voted: null,
    votesReceived: null,
    shield: false,
    out: null,
    ...rest,
  });
  api.getPlayer.mockResolvedValue({
    ...PROFILE,
    story: [
      at(4, { title: "The Reckoning", voted: "bo-banks", votesReceived: 7, out: { how: "banished" } }),
      at(3, { voted: "cy-cole", votesReceived: 0, shield: true }),
      at(1, { season: "tus-1" }),
    ],
  });
  render(<PlayerScreen />);

  const s2 = within(await screen.findByRole("region", { name: "Season 2, episode by episode" }));
  const rows = s2.getAllByRole("listitem");
  expect(rows.map((li) => li.getAttribute("aria-label"))).toEqual(["Episode 3", "Episode 4"]);
  const third = within(rows[0]);
  expect(third.getByRole("link", { name: "Cy Cole" }).getAttribute("href")).toMatch(/show=tus&id=cy-cole&season=tus-2$/);
  expect(third.getByText("No votes against")).toBeTruthy();
  expect(third.getByText("Shield")).toBeTruthy();
  const fourth = within(rows[1]);
  expect(fourth.getByText("The Reckoning")).toBeTruthy();
  expect(fourth.getByText(/votes against/).textContent).toBe("7 votes against");
  expect(fourth.getByText("banished")).toBeTruthy();
  // Seasons in the profile's order, newest first.
  expect(screen.getAllByRole("region", { name: /episode by episode$/ }).map((r) => r.getAttribute("aria-label"))).toEqual([
    "Season 2, episode by episode",
    "Season 1, episode by episode",
  ]);
});

it("says when there's no biography or story yet, and credits a Fandom bio", async () => {
  api.getPlayer.mockResolvedValueOnce({ ...PROFILE, bio: null, story: [] });
  render(<PlayerScreen />);
  expect(await screen.findByText("No biography yet.")).toBeTruthy();
  expect(screen.getByText("Each episode fills in here once its results are yours to see.")).toBeTruthy();
  cleanup();

  const fandom = "https://thetraitors.fandom.com/wiki/Ann_Avery";
  api.getPlayer.mockResolvedValueOnce({ ...PROFILE, bio: { text: "Ann is a nurse.", source: "fandom", sourceUrl: fandom } });
  render(<PlayerScreen />);
  expect((await screen.findByRole("link", { name: "From The Traitors Wiki (Fandom)" })).getAttribute("href")).toBe(fandom);
});

it("heads the profile with a bio credited to Wikipedia and a badge for each season won", async () => {
  api.getPlayer.mockResolvedValue(PROFILE);
  render(<PlayerScreen />);
  expect(await screen.findByText("Ann Avery is a nurse from Ohio.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "From Wikipedia" }).getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Ann_Avery");
  expect(screen.getByText("Won Season 1")).toBeTruthy();
  const seasons = within(screen.getByRole("list", { name: "Seasons played" })).getAllByRole("listitem");
  expect(within(seasons[2]).getByText("Champion")).toBeTruthy();
  expect(within(seasons[1]).queryByText("Champion")).toBeNull();
});

it("paints the red X onto someone banished in their latest season, and not on someone still in", async () => {
  const banished = { ...PROFILE, seasons: PROFILE.seasons.filter((s) => s.season === "tus-2") };
  api.getPlayer.mockResolvedValueOnce(banished);
  const { container, unmount } = render(<PlayerScreen />);
  await screen.findByRole("heading", { name: "Ann Avery" });
  const out = container.querySelector('[data-out="banished"]');
  expect(out).toBeTruthy();
  expect(out!.querySelectorAll("mask path.animate-draw")).toHaveLength(2);
  unmount();

  // Still in the current season: no X, whatever happened before.
  api.getPlayer.mockResolvedValueOnce(PROFILE);
  const again = render(<PlayerScreen />);
  await screen.findByRole("heading", { name: "Ann Avery" });
  expect(again.container.querySelector("[data-out]")).toBeNull();
});

const entry = (ep: number, rest: Partial<StoryEpisode>): StoryEpisode => ({
  season: "tus-2",
  ep,
  title: null,
  voted: null,
  votesReceived: null,
  shield: false,
  out: null,
  murdered: null,
  recruited: null,
  ...rest,
});

it("shows everyone the story names with their photo, and a Traitor's murders and recruits", async () => {
  api.getPlayer.mockResolvedValue({
    ...PROFILE,
    seasons: PROFILE.seasons.map((s) => (s.season === "tus-2" ? { ...s, traitorFrom: 1 } : s)),
    story: [
      entry(2, { voted: "bo-banks", votesReceived: 0, murdered: [] }),
      entry(3, { voted: "cy-cole", votesReceived: 2, murdered: ["bo-banks", "di-dunn"], recruited: ["ed-eaves"] }),
    ],
    people: {
      "bo-banks": { name: "Bo Banks", headshot: "bo.jpg" },
      "cy-cole": { name: "Cy Cole", headshot: null },
      "ed-eaves": { name: "Ed Eaves", headshot: "ed.jpg" },
    },
  });
  render(<PlayerScreen />);

  const s2 = within(await screen.findByRole("region", { name: "Season 2, episode by episode" }));
  expect(s2.getByText("Traitor from episode 1")).toBeTruthy();
  const [second, third] = s2.getAllByRole("listitem").map((li) => within(li));

  const photo = (link: HTMLElement) => link.querySelector("img")?.getAttribute("src");
  expect(photo(second.getByRole("link", { name: "Bo Banks" }))).toMatch(/\/headshots\/bo\.jpg$/);
  // No photo on file: the hood, still under their real name.
  const cy = third.getByRole("link", { name: "Cy Cole" });
  expect(cy.querySelector("img")).toBeNull();
  expect(cy.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Cy Cole");
  // Nobody killed that night: no Murdered line rather than an empty one.
  expect(second.queryByRole("group", { name: "Murdered" })).toBeNull();

  const murdered = within(third.getByRole("group", { name: "Murdered" }));
  expect(murdered.getAllByRole("link").map(spoken)).toEqual(["Bo Banks", "Di Dunn"]);
  expect(photo(murdered.getByRole("link", { name: "Bo Banks" }))).toMatch(/\/headshots\/bo\.jpg$/);
  expect(murdered.getByRole("link", { name: "Di Dunn" }).getAttribute("href")).toMatch(/show=tus&id=di-dunn&season=tus-2$/);
  const recruited = within(third.getByRole("group", { name: "Recruited" }));
  expect(photo(recruited.getByRole("link", { name: "Ed Eaves" }))).toMatch(/\/headshots\/ed\.jpg$/);
});

it("says nothing of murders for a player the API doesn't name a Traitor", async () => {
  api.getPlayer.mockResolvedValue({ ...PROFILE, story: [entry(3, { votesReceived: 1 })] });
  render(<PlayerScreen />);
  const s2 = within(await screen.findByRole("region", { name: "Season 2, episode by episode" }));
  expect(s2.queryByText(/Traitor from/)).toBeNull();
  expect(s2.queryByRole("group", { name: "Murdered" })).toBeNull();
  expect(s2.queryByRole("group", { name: "Recruited" })).toBeNull();
});
