import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeskDemo } from "@/components/desk-demo";

const desk = () => screen.getByRole("img").getAttribute("aria-label") ?? "";

describe("DeskDemo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("moves to the next invented performance, and Pause holds it", () => {
    render(<DeskDemo />);
    expect(desk()).toMatch(/^Couple 3/);
    expect(desk()).toContain("Panel average 7.7. You were 0.3 above.");

    act(() => vi.advanceTimersByTime(6500));
    expect(desk()).toMatch(/^Couple 5/);

    fireEvent.click(screen.getByRole("button", { name: "Pause the demo" }));
    act(() => vi.advanceTimersByTime(20000));
    expect(desk()).toMatch(/^Couple 5/);
    expect(screen.getByRole("button", { name: "Play the demo" })).toBeTruthy();
  });

  it("stays on one revealed desk under reduced motion", () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: media.includes("reduce"),
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<DeskDemo />);
    act(() => vi.advanceTimersByTime(20000));
    expect(desk()).toMatch(/^Couple 3/);
    expect(screen.queryByRole("button")).toBeNull();
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
});
