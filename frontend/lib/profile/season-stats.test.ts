import { describe, expect, it } from "vitest";

import type { ProfileDance } from "@/lib/api/profile";
import { square } from "./crop";
import { byStyle, calls, closestJudge, distribution } from "./season-stats";

const dance = (key: string, style: string | null, paddle: number, panelMean: number): ProfileDance => ({
  ep: 1,
  key,
  style,
  paddle,
  panelMean,
  error: Math.abs(paddle - panelMean),
});

const DANCES = [
  dance("a#1", "Tango", 8, 7),
  dance("b#1", "Tango", 6, 8),
  dance("c#1", "Rumba", 7, 7),
  dance("d#1", null, 9, 6),
];

describe("season stats", () => {
  it("averages the gap per style, closest first, leaving out unknown styles", () => {
    expect(byStyle(DANCES)).toEqual([
      { style: "Rumba", count: 1, mae: 0 },
      { style: "Tango", count: 2, mae: 1.5 },
    ]);
  });

  it("counts paddles 1-10 beside the rounded judges' average", () => {
    const counts = distribution(DANCES);
    expect(counts).toHaveLength(10);
    expect(counts.find((c) => c.score === 7)).toEqual({ score: 7, you: 1, judges: 2 });
    expect(counts.find((c) => c.score === 9)).toEqual({ score: 9, you: 1, judges: 0 });
    expect(distribution([dance("x#1", "Jive", 8, 7.5)])[7]).toEqual({ score: 8, you: 1, judges: 1 });
  });

  it("picks the closest and furthest calls, earliest on a tie", () => {
    expect(calls(DANCES)).toEqual({ best: DANCES[2], worst: DANCES[3] });
    expect(calls([])).toBeNull();
  });

  it("names the judge with the smallest gap", () => {
    expect(closestJudge({ derek: { mae: 1.2 }, carrie: { mae: 0.4 } })).toBe("carrie");
    expect(closestJudge({})).toBeNull();
  });
});

describe("crop square", () => {
  it("starts as the largest centred square", () => {
    expect(square(400, 200, 1, 200, 100)).toEqual({ x: 100, y: 0, size: 200 });
  });

  it("shrinks with zoom and stays inside the image", () => {
    expect(square(400, 200, 2, 200, 100)).toEqual({ x: 150, y: 50, size: 100 });
    expect(square(400, 200, 2, 0, 0)).toEqual({ x: 0, y: 0, size: 100 });
    expect(square(400, 200, 2, 999, 999)).toEqual({ x: 300, y: 100, size: 100 });
  });

  it("clamps zoom to its range", () => {
    expect(square(400, 200, 0.5, 200, 100).size).toBe(200);
    expect(square(400, 200, 100, 200, 100).size).toBe(50);
  });
});
