import { describe, expect, it } from "vitest";

import { square } from "./crop";
import { closestJudge } from "./season-stats";

describe("season stats", () => {
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
