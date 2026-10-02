import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getHistory: vi.fn() }));
vi.mock("@/lib/api/history", () => api);

import type { History } from "@/lib/api/history";

import { HistoryScreen } from "./history-screen";

const player = (id: string, name: string, faction: "Faithful" | "Traitor", exit: { ep: number; how: string } | null) => ({
  id,
  name,
  headshot: null,
  faction,
  exit,
});

const HISTORY: History = {
  season: "tus-3",
  title: "The Traitors (American TV series) season 3",
  winners: [{ id: "ann-avery", faction: "Traitor" }],
  players: [
    player("ann-avery", "Ann Avery", "Traitor", { ep: 3, how: "winner" }),
    player("bo-banks", "Bo Banks", "Traitor", { ep: 2, how: "banished" }),
    player("cy-cole", "Cy Cole", "Faithful", { ep: 2, how: "murdered" }),
    player("di-dunn", "Di Dunn", "Faithful", { ep: 3, how: "banished" }),
    player("ed-eaves", "Ed Eaves", "Faithful", { ep: 3, how: "runner-up" }),
  ],
  episodes: [
    { ep: 1, title: "Arrival", airDate: "2025-01-09", releaseAt: "2025-01-10T02:00:00Z", roundTable: null, murdered: [], recruited: null },
    {
      ep: 2,
      title: null,
      airDate: "2025-01-16",
      releaseAt: "2025-01-17T02:00:00Z",
      roundTable: { banished: "bo-banks", faction: "Traitor", firstVote: { "bo-banks": 3, "di-dunn": 1 } },
      murdered: ["cy-cole"],
      recruited: ["ed-eaves"],
    },
  ],
};

afterEach(() => vi.clearAllMocks());

it("crowns a Traitor win in red and lists the cast with how each left", async () => {
  api.getHistory.mockResolvedValue(HISTORY);
  render(<HistoryScreen season="tus-3" />);

  const winners = await screen.findByRole("region", { name: "The Traitors take the pot" });
  // Next drops the trailing slash under test; the export config puts it back.
  expect(within(winners).getByRole("link", { name: /Ann Avery/ }).getAttribute("href")).toMatch(
    /^\/players\/player\/?\?show=tus&id=ann-avery&season=tus-3$/,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Season 3");

  const cast = within(screen.getByRole("region", { name: "Final standings" }));
  // Winner first, then whoever lasted longest.
  const tiles = [
    "Ann Avery, Traitor, Winner",
    "Di Dunn, Faithful, Banished ep 3",
    "Ed Eaves, Faithful, Runner-up ep 3",
    "Bo Banks, Traitor, Banished ep 2",
    "Cy Cole, Faithful, Murdered ep 2",
  ];
  expect(cast.getAllByRole("link")).toEqual(tiles.map((name) => cast.getByRole("link", { name })));
});

it("seats each round table with its first votes in chalk and marks the banished seat", async () => {
  api.getHistory.mockResolvedValue(HISTORY);
  render(<HistoryScreen season="tus-3" />);

  const table = within(await screen.findByRole("group", { name: "Episode 2 round table" }));
  // That morning's murder isn't at the table; nobody left before it is.
  const seats = table.getAllByRole("link");
  expect(seats.map((seat) => seat.getAttribute("aria-label"))).toEqual([
    "Ann Avery",
    "Bo Banks, banished, Traitor, 3 votes",
    "Di Dunn, 1 vote",
    "Ed Eaves",
  ]);
  expect(table.queryAllByRole("button")).toHaveLength(0);

  const night = within(screen.getByRole("listitem", { name: "Episode 2" }));
  expect(night.getByText(/Murdered:/).textContent).toBe("Murdered: Cy Cole");
  expect(night.getByText(/Recruited:/).textContent).toBe("Recruited: Ed Eaves");
  expect(night.getByText(/Banished:/).textContent).toContain("Bo Banks");

  const first = within(screen.getByRole("listitem", { name: "Arrival" }));
  expect(first.getByText("No round table this episode.")).toBeTruthy();
  expect(first.getByText("No one murdered")).toBeTruthy();
});

it("links every past-season player to their profile: cast wall, round-table seat and timeline", async () => {
  api.getHistory.mockResolvedValue(HISTORY);
  render(<HistoryScreen season="tus-3" />);
  const profile = /^\/players\/player\/?\?show=tus&id=cy-cole&season=tus-3$/;

  const cast = within(await screen.findByRole("region", { name: "Final standings" }));
  expect(cast.getByRole("link", { name: /^Cy Cole/ }).getAttribute("href")).toMatch(profile);

  const night = within(screen.getByRole("listitem", { name: "Episode 2" }));
  expect(night.getByRole("link", { name: "Cy Cole" }).getAttribute("href")).toMatch(profile);
  const seat = within(night.getByRole("group", { name: "Episode 2 round table" })).getByRole("link", { name: /^Di Dunn/ });
  expect(seat.getAttribute("href")).toMatch(/id=di-dunn&season=tus-3$/);
});

it("shows a gold banner for a Faithful win", async () => {
  api.getHistory.mockResolvedValue({ ...HISTORY, winners: [{ id: "ed-eaves", faction: "Faithful" }] });
  render(<HistoryScreen season="tus-3" />);
  expect(await screen.findByRole("region", { name: "The Faithful take the pot" })).toBeTruthy();
});

it("offers a retry when the season won't load", async () => {
  api.getHistory.mockRejectedValueOnce(new Error("castle closed")).mockResolvedValueOnce(HISTORY);
  render(<HistoryScreen season="tus-3" />);
  expect((await screen.findByRole("alert")).textContent).toContain("castle closed");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("region", { name: "Final standings" })).toBeTruthy();
  expect(api.getHistory).toHaveBeenCalledTimes(2);
});
