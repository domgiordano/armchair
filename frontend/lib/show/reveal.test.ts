import { describe, expect, it } from "vitest";

import { spotlight } from "@/lib/show/reveal";

describe("spotlight", () => {
  const totals = { ada: 21, bo: 13, cy: 24, di: 20, ed: 25 };

  it("lights whoever went home among the night's lowest, in id order", () => {
    // Ada went home on 21 while Bo's 13 was the lowest: both stay in the light.
    expect(spotlight(["ada"], totals)).toEqual(["ada", "bo", "di"]);
  });

  it("keeps a safe couple in the light on a double elimination", () => {
    expect(spotlight(["ada", "bo", "cy"], totals)).toEqual(["ada", "bo", "cy", "di"]);
  });

  it("lights the lowest when nobody went home", () => {
    expect(spotlight([], totals)).toEqual(["ada", "bo", "di"]);
  });

  it("breaks a tie by id and copes with no totals", () => {
    expect(spotlight([], { b: 10, a: 10, c: 10, d: 9 }, 2)).toEqual(["a", "d"]);
    expect(spotlight(["ada"], {})).toEqual(["ada"]);
  });
});
