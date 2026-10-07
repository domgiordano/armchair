import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupCarousel } from "./group-carousel";

const SCORES = [
  { sub: "a", name: "Sam Friend", picture: null, value: 9 },
  { sub: "b", name: "Lee Friend", picture: null, value: 6 },
  { sub: "c", name: "Jo Friend", picture: null, value: 8 },
];

const current = () =>
  within(screen.getByRole("region", { name: "Family scores" }))
    .getAllByRole("button", { name: /^Show / })
    .findIndex((b) => b.getAttribute("aria-current") === "true");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GroupCarousel", () => {
  it("turns to the next member every 3 seconds and wraps around", () => {
    render(<GroupCarousel group="Family" scores={SCORES} panelMean={7.5} />);
    expect(current()).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(current()).toBe(1);
    act(() => vi.advanceTimersByTime(6000));
    expect(current()).toBe(0);
  });

  it("holds still while focused or paused, and steps with the arrow keys", () => {
    render(<GroupCarousel group="Family" scores={SCORES} panelMean={7.5} />);
    const carousel = screen.getByRole("region", { name: "Family scores" });
    const next = within(carousel).getByRole("button", { name: "Next" });
    fireEvent.focus(next);
    act(() => vi.advanceTimersByTime(9000));
    expect(current()).toBe(0);
    fireEvent.keyDown(next, { key: "ArrowLeft" });
    expect(current()).toBe(2);
    fireEvent.click(next);
    expect(current()).toBe(0);

    fireEvent.click(within(carousel).getByRole("button", { name: "Pause" }));
    fireEvent.blur(next);
    act(() => vi.advanceTimersByTime(9000));
    expect(current()).toBe(0);
    expect(within(carousel).getByRole("list").getAttribute("aria-live")).toBe("polite");
    fireEvent.click(within(carousel).getByRole("button", { name: "Play" }));
    act(() => vi.advanceTimersByTime(3000));
    expect(current()).toBe(1);
  });

  it("waits after a touch before turning again", () => {
    render(<GroupCarousel group="Family" scores={SCORES} panelMean={7.5} />);
    fireEvent.touchStart(screen.getByRole("region", { name: "Family scores" }));
    act(() => vi.advanceTimersByTime(8000));
    expect(current()).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(current()).toBe(1);
  });

  it("names each member's gap to the judges, or only their paddle before you reveal", () => {
    const { rerender } = render(<GroupCarousel group="Family" scores={SCORES} panelMean={7.5} />);
    const lines = () => screen.getAllByRole("group").map((s) => s.textContent);
    expect(lines()[0]).toContain("1.5 above the judges");
    expect(lines()[1]).toContain("1.5 below the judges");
    rerender(<GroupCarousel group="Family" scores={SCORES} panelMean={null} />);
    expect(lines()[0]).toContain("Gave it a 9");
    expect(lines().join(" ")).not.toMatch(/judges/);
  });

  it("doesn't move on its own under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    render(<GroupCarousel group="Family" scores={SCORES} panelMean={7.5} />);
    act(() => vi.advanceTimersByTime(9000));
    expect(current()).toBe(0);
  });
});
