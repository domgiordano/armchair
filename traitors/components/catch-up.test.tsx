import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { SeasonEpisode } from "@/lib/api/traitors";

import { CatchUp } from "./catch-up";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const ep = (n: number, answered: number): SeasonEpisode => ({
  ep: n,
  title: null,
  releaseAt: `2026-10-0${n}T00:00:00Z`,
  closed: false,
  events: 3,
  answered,
});
const EPISODES = [ep(1, 3), ep(2, 1), ep(3, 0), ep(4, 0)];

it("stops at the spoiler and sends you back to the oldest unfinished episode", () => {
  const onCatchUp = vi.fn();
  render(
    <CatchUp episodes={EPISODES} episode={EPISODES[3]} now={NOW} onCatchUp={onCatchUp}>
      <p>Ballot</p>
    </CatchUp>,
  );
  expect(screen.getByRole("heading", { name: "You have calls to make in 2 earlier episodes" })).toBeTruthy();
  expect(screen.queryByText("Ballot")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to episode 2" }));
  expect(onCatchUp).toHaveBeenCalledWith(2);
});

it("opens the episode anyway when asked", () => {
  render(
    <CatchUp episodes={EPISODES} episode={EPISODES[3]} now={NOW} onCatchUp={vi.fn()}>
      <p>Ballot</p>
    </CatchUp>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open it anyway" }));
  expect(screen.getByText("Ballot")).toBeTruthy();
});

it("says nothing when every earlier episode is called", () => {
  render(
    <CatchUp episodes={EPISODES} episode={EPISODES[1]} now={NOW} onCatchUp={vi.fn()}>
      <p>Ballot</p>
    </CatchUp>,
  );
  expect(screen.getByText("Ballot")).toBeTruthy();
});
