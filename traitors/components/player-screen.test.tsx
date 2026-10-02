import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));
const api = vi.hoisted(() => ({ getPlayer: vi.fn(), searchPlayers: vi.fn(), SEARCH_MIN: 2 }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.search) }));
vi.mock("@/lib/api/history", () => api);
vi.mock("@/components/season-provider", () => ({ useShellSeason: () => ({ edition: "uk", season: "tukc-2" }) }));

import type { PlayerProfile } from "@/lib/api/history";

import { PlayerScreen } from "./player-screen";
import { PlayerSearch } from "./player-search";

const PROFILE: PlayerProfile = {
  id: "ann-avery",
  name: "Ann Avery",
  headshot: null,
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
    },
    { season: "tus-5", number: 5, current: true, finish: null, faction: null, votes: null },
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
  expect(seasons.map((li) => li.getAttribute("aria-label"))).toEqual(["Season 5", "Season 2"]);

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
