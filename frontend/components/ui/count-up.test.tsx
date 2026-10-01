import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountUp } from "./count-up";

const motion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CountUp", () => {
  it("counts from zero to the exact value", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    motion(false);
    render(
      <p>
        <CountUp value={1.05} format={(n) => `${n.toFixed(2)} off`} />
      </p>,
    );
    expect(screen.getByText("0.00 off")).toBeTruthy();
    act(() => vi.advanceTimersByTime(450));
    const mid = Number.parseFloat(screen.getByText(/off$/).textContent ?? "");
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1.05);
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByText("1.05 off")).toBeTruthy();
  });

  it("shows the value at once under reduced motion", () => {
    motion(true);
    render(
      <p>
        <CountUp value={34} />
      </p>,
    );
    expect(screen.getByText("34")).toBeTruthy();
  });
});
