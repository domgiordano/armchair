import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COUNT_MS, CountUp } from "@/components/count-up";

let enter: () => void = () => {};

class FakeObserver {
  constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {
    enter = () => this.cb([{ isIntersecting: true }]);
  }
  observe() {}
  disconnect() {}
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: reduce && media.includes("reduce"),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const shown = (container: HTMLElement) => container.querySelector("[aria-hidden]")?.textContent;

describe("CountUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    setReducedMotion(false);
    delete document.documentElement.dataset.intro;
  });

  it("counts from 0 once in view and lands on the exact value", () => {
    const { container } = render(<CountUp value={437} />);
    expect(shown(container)).toBe("0");
    expect(container.querySelector(".sr-only")?.textContent).toBe("437");

    act(() => enter());
    act(() => vi.advanceTimersByTime(COUNT_MS / 2));
    const mid = Number(shown(container));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(437);

    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(shown(container)).toBe("437");
  });

  it("holds at 0 while the intro covers the page", async () => {
    document.documentElement.dataset.intro = "playing";
    const { container } = render(<CountUp value={35} />);
    act(() => enter());
    act(() => vi.advanceTimersByTime(COUNT_MS * 2));
    expect(shown(container)).toBe("0");

    delete document.documentElement.dataset.intro;
    // MutationObserver callbacks run as microtasks.
    await act(() => vi.advanceTimersByTimeAsync(COUNT_MS * 2));
    expect(shown(container)).toBe("35");
  });

  it("shows the final number straight away under reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(<CountUp value={44} />);
    expect(shown(container)).toBe("44");
  });
});
