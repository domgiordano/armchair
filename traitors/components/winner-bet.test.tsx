import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ submitWinner: vi.fn() }));
vi.mock("@/lib/api/traitors", () => api);
vi.mock("@armchair/app-core/api/client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { ApiError } from "@armchair/app-core/api/client";
import type { BetGate } from "@/lib/api/traitors";

import { WinnerBet } from "./winner-bet";

const GATE: BetGate = {
  season: "tus-5",
  title: "New Blood",
  current: true,
  needsBet: true,
  episodes: 12,
  released: 4,
  players: ["Ava Stone", "Ben Hart", "Cal Reyes"].map((name) => ({ id: name.toLowerCase().replace(" ", "-"), name, headshot: null })),
};

afterEach(() => vi.clearAllMocks());

const seal = () => screen.getByRole("button", { name: "Seal your bet" }) as HTMLButtonElement;

it("shows what a bet is worth this late", () => {
  render(<WinnerBet gate={GATE} onSealed={vi.fn()} />);
  expect(screen.getByText("Worth 67% now")).toBeTruthy();
  expect(screen.getByText(/4 of 12 episodes are already out/)).toBeTruthy();
});

it("takes two players at most, each with a side, then seals the bet", async () => {
  api.submitWinner.mockResolvedValue({});
  const onSealed = vi.fn();
  render(<WinnerBet gate={GATE} onSealed={onSealed} />);
  expect(seal().disabled).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Ava Stone" }));
  fireEvent.click(screen.getByRole("button", { name: "Cal Reyes" }));
  expect((screen.getByRole("button", { name: "Ben Hart" }) as HTMLButtonElement).disabled).toBe(true);
  expect(seal().disabled).toBe(true);

  fireEvent.click(screen.getAllByRole("radio", { name: "Traitor" })[0]);
  fireEvent.click(screen.getAllByRole("radio", { name: "Faithful" })[1]);
  expect(seal().disabled).toBe(false);

  fireEvent.click(seal());
  await vi.waitFor(() => expect(onSealed).toHaveBeenCalledOnce());
  expect(api.submitWinner).toHaveBeenCalledWith("tus-5", [
    { player: "ava-stone", faction: "Traitor" },
    { player: "cal-reyes", faction: "Faithful" },
  ]);
});

it("tapping a pick again frees the slot", () => {
  render(<WinnerBet gate={GATE} onSealed={vi.fn()} />);
  const ava = screen.getByRole("button", { name: "Ava Stone" });
  fireEvent.click(ava);
  expect(ava.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(ava);
  expect(ava.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("radio")).toBeNull();
});

it("opens the season when another device already sealed a bet", async () => {
  api.submitWinner.mockRejectedValue(new ApiError(409, "Already bet"));
  const onSealed = vi.fn();
  render(<WinnerBet gate={GATE} onSealed={onSealed} />);
  fireEvent.click(screen.getByRole("button", { name: "Ben Hart" }));
  fireEvent.click(screen.getByRole("radio", { name: "Faithful" }));
  fireEvent.click(seal());
  await vi.waitFor(() => expect(onSealed).toHaveBeenCalledOnce());
});
