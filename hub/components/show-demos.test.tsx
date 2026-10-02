import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChalkTallyDemo, finishOrder, slatePoints } from "@/components/chalk-tally-demo";
import { LeagueDemo } from "@/components/league-demo";
import { PaddleFlipDemo } from "@/components/paddle-flip-demo";

const label = () => screen.getByRole("img").getAttribute("aria-label") ?? "";

describe("Traitors slate scoring", () => {
  it("ranks the round table by votes, an earlier finish breaking a tie", () => {
    expect(finishOrder([0, 2, 0, 1, 2, 0, 4, 0, 2])).toEqual([0, 2, 1]);
  });

  it("scores exact slots 5, 3 and 2, and a right name in the wrong slot 1", () => {
    expect(slatePoints([0, 2, 1], [0, 2, 1])).toEqual([5, 3, 2]);
    expect(slatePoints([1, 3, 4], [3, 1, 4])).toEqual([1, 1, 2]);
    expect(slatePoints([5, 6, 7], [0, 1, 2])).toEqual([0, 0, 0]);
  });
});

describe("looping show demos", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("moves the paddle demo to the next dance, and Pause holds it", () => {
    render(<PaddleFlipDemo />);
    expect(label()).toMatch(/^Week 3 · Foxtrot/);
    act(() => vi.advanceTimersByTime(6500));
    expect(label()).toMatch(/^Week 3 · Samba/);
    fireEvent.click(screen.getByRole("button", { name: "Pause the demo" }));
    act(() => vi.advanceTimersByTime(30000));
    expect(label()).toMatch(/^Week 3 · Samba/);
  });

  it("tallies the next episode on the slate", () => {
    render(<ChalkTallyDemo />);
    expect(label()).toContain("Episode 4");
    act(() => vi.advanceTimersByTime(8000));
    expect(label()).toContain("Jules banished. Your slate scores 4 points.");
  });

  it("switches the group board to the other show's ranking", () => {
    render(<LeagueDemo />);
    act(() => vi.advanceTimersByTime(4500));
    expect(label()).toMatch(/The Traitors, Points: 1 Jo 38, 2 You 31/);
  });

  it("holds the first frame with no pause control under reduced motion", () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: media.includes("reduce"),
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<ChalkTallyDemo />);
    act(() => vi.advanceTimersByTime(30000));
    expect(label()).toContain("Episode 4");
    expect(screen.queryByRole("button")).toBeNull();
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
});
