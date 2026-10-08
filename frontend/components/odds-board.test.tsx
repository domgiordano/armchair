import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/favorites/odds", async (actual) => ({
  ...(await actual<typeof import("@armchair/app-core/favorites/odds")>()),
  getOdds: vi.fn(),
}));

import { getOdds, type OddsBoard as Board } from "@armchair/app-core/favorites/odds";
import { seal } from "@/lib/show/sealed";
import { OddsBoard } from "./odds-board";

const entry = (id: string, rank: number, chance: number, odds: string, over = {}) => ({
  id,
  rank,
  chance,
  odds,
  model: 0.2,
  market: chance,
  inputs: {},
  why: [],
  move: null,
  name: `Star ${id}`,
  partner: `Pro ${id}`,
  headshot: null,
  ...over,
});

function board(over: Partial<Board<null>> = {}): Board<null> {
  return {
    season: "dwts-35",
    show: "dwts",
    revealed: 4,
    asOf: 4,
    latest: 4,
    behind: false,
    source: "market",
    model: "Judges' scores, survival and our crowd's scores",
    market: { source: "Polymarket", url: "https://polymarket.com/event/x", capturedAt: "2026-10-05T16:00:00Z" },
    episodes: [1, 2, 3, 4, 5].map((ep) => ({ ep, week: ep })),
    entries: [
      entry("a", 1, 0.56, "-125", { why: ["Market favorite", "Top judges' average"], move: { rank: 1, chance: 0.08 } }),
      entry("b", 2, 0.14, "+615", { move: { rank: -1, chance: -0.02 } }),
    ],
    ...over,
  };
}

describe("OddsBoard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getOdds).mockReset();
  });

  it("lists American odds with the chance, movement and why chips, favorite first", async () => {
    vi.mocked(getOdds).mockResolvedValue(board());
    render(<OddsBoard season="dwts-35" />);
    const rows = await screen.findAllByRole("listitem", { name: undefined });
    const first = rows[0];
    expect(within(first).getByText("Star a")).toBeTruthy();
    expect(within(first).getByText("-125")).toBeTruthy();
    expect(within(first).getByText("56%")).toBeTruthy();
    expect(within(first).getByText("Up 1 place")).toBeTruthy();
    expect(within(first).getByText("Top judges' average")).toBeTruthy();
    expect(screen.getByText(/Odds via Polymarket as of Oct 5/)).toBeTruthy();
    expect(screen.queryByText(/update after you finish/)).toBeNull();
  });

  it("says the board is held at the last episode you finished, without naming a result", async () => {
    vi.mocked(getOdds).mockResolvedValue(board({ behind: true, latest: 5 }));
    render(<OddsBoard season="dwts-35" />);
    expect(await screen.findByText(/As of Week 4\. The odds update after you finish Week 5/)).toBeTruthy();
  });

  it("labels model odds when there is no market", async () => {
    vi.mocked(getOdds).mockResolvedValue(board({ market: null, source: "model" }));
    render(<OddsBoard season="dwts-35" />);
    expect(await screen.findByText("Armchair odds (model)")).toBeTruthy();
    expect(screen.getByText(/No published odds for this season/)).toBeTruthy();
  });

  it("holds the board before an episode with a sealed dance", async () => {
    seal("dwts-35", 5, "a#1");
    vi.mocked(getOdds).mockResolvedValue(board());
    render(<OddsBoard season="dwts-35" />);
    await screen.findByText("Star a");
    expect(getOdds).toHaveBeenLastCalledWith("dwts-35", 4);
  });
});
