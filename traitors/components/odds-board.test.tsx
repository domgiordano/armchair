import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/favorites/odds", async (actual) => ({
  ...(await actual<typeof import("@armchair/app-core/favorites/odds")>()),
  getOdds: vi.fn(),
}));

import { getOdds, type OddsBoard as Board } from "@armchair/app-core/favorites/odds";
import { OddsBoard } from "./odds-board";

const entry = (id: string, rank: number, chance: number, odds: string, over = {}) => ({
  id,
  rank,
  chance,
  odds,
  model: chance,
  market: null,
  inputs: {},
  why: [],
  move: null,
  name: id.toUpperCase(),
  partner: null,
  headshot: null,
  ...over,
});

const board = (over: Partial<Board<string | null>> = {}): Board<string | null> => ({
  season: "tukc-2",
  show: "tukc",
  revealed: 2,
  asOf: 2,
  latest: 2,
  behind: false,
  source: "model",
  model: "Our crowd's winner picks, round table votes and shields",
  market: null,
  entries: [
    entry("ann", 1, 0.31, "+225", { why: ["Crowd's top winner pick"], move: { rank: 0, chance: 0.04 } }),
    entry("ben", 2, 0.2, "+400", { why: ["3 votes last round table"], move: { rank: 0, chance: -0.05 } }),
    entry("cal", 3, 0.12, "+735"),
    entry("dee", 4, 0.1, "+900"),
  ],
  ...over,
});

describe("Traitors OddsBoard", () => {
  beforeEach(() => vi.mocked(getOdds).mockReset());

  it("shows model odds as Armchair odds, favorite first", async () => {
    vi.mocked(getOdds).mockResolvedValue(board());
    render(<OddsBoard season="tukc-2" top={3} />);
    expect(await screen.findByText("Armchair odds (model)")).toBeTruthy();
    const first = screen.getByText("ANN").closest("li") as HTMLElement;
    expect(within(first).getByText("+225")).toBeTruthy();
    expect(within(first).getByText("31%")).toBeTruthy();
    expect(within(first).getByText("Up 4 points")).toBeTruthy();
    expect(screen.queryByText("DEE")).toBeNull();
    expect(screen.getByRole("button", { name: "Show all 4" })).toBeTruthy();
  });

  it("holds at the last episode you've called, without saying who left after it", async () => {
    vi.mocked(getOdds).mockResolvedValue(board({ behind: true, latest: 3 }));
    render(<OddsBoard season="tukc-2" />);
    expect(await screen.findByText(/As of episode 2\. The odds update after you make your calls in episode 3/)).toBeTruthy();
    expect(screen.getByText("DEE")).toBeTruthy();
  });
});
