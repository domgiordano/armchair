import { describe, expect, it } from "vitest";

import type { Dance } from "@/lib/api/stats";
import { byStyle, distribution, extremes } from "./stats-summary";

const dance = (ep: number, error: number, style: string | null = "Tango", paddle = 8): Dance => ({
  ep,
  key: `c${ep}#1`,
  paddle,
  panelMean: paddle - error,
  error,
  style,
  judges: { a: 7, b: 9 },
});

describe("byStyle", () => {
  it("averages per style, closest first, with no style as Other", () => {
    expect(byStyle([dance(1, 2), dance(2, 1), dance(3, 0.5, null)])).toEqual([
      { label: "Other", value: 0.5, count: 1 },
      { label: "Tango", value: 1.5, count: 2 },
    ]);
  });
});

describe("distribution", () => {
  it("gives shares of your paddles and of every judge score", () => {
    const bins = distribution([dance(1, 0, "Tango", 7), dance(2, 0, "Tango", 9)]);
    expect(bins).toHaveLength(10);
    expect(bins[6]).toEqual({ value: 7, mine: 0.5, judges: 0.5 });
    expect(bins[0]).toEqual({ value: 1, mine: 0, judges: 0 });
  });

  it("is all zeros with no dances", () => {
    expect(distribution([]).every((b) => b.mine === 0 && b.judges === 0)).toBe(true);
  });
});

describe("extremes", () => {
  it("takes up to n from each end", () => {
    const ds = [0, 3, 1, 2, 0.5, 4, 2.5, 0.2].map((e, i) => dance(i + 1, e));
    const { closest, furthest } = extremes(ds);
    expect(closest.map((d) => d.error)).toEqual([0, 0.2, 0.5]);
    expect(furthest.map((d) => d.error)).toEqual([4, 3, 2.5]);
  });

  it("never lists a dead-on call as a miss", () => {
    const { closest, furthest } = extremes([dance(1, 0), dance(2, 0)]);
    expect(closest).toHaveLength(1);
    expect(furthest).toEqual([]);
  });
});
