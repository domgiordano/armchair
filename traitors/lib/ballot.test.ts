import { describe, expect, it } from "vitest";

import type { EpisodeEvent } from "@/lib/api/traitors";

import { consensusRows, move, seatLayout, tableWidth, toggle } from "./ballot";

describe("ballot", () => {
  it("chalks names in order, rubs one out, and ignores a fourth", () => {
    expect(toggle([], "a", 3)).toEqual(["a"]);
    expect(toggle(["a", "b"], "c", 3)).toEqual(["a", "b", "c"]);
    expect(toggle(["a", "b", "c"], "d", 3)).toEqual(["a", "b", "c"]);
    expect(toggle(["a", "b", "c"], "a", 3)).toEqual(["b", "c"]);
  });

  it("swaps a single pick and clears it on a second tap", () => {
    expect(toggle(["a"], "b", 1)).toEqual(["b"]);
    expect(toggle(["a"], "a", 1)).toEqual([]);
  });

  it("moves a rank up or down within the slate", () => {
    expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(move(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("ranks the round table's consensus by who people put first", () => {
    const rt = {
      type: "RT",
      consensus: { voters: 8, picks: { a: 8, b: 7, c: 9 }, first: { a: 5, c: 3 } },
    } as unknown as EpisodeEvent;
    expect(consensusRows(rt)).toEqual([
      { id: "a", count: 5, share: 5 / 8 },
      { id: "c", count: 3, share: 3 / 8 },
    ]);
    const murder = { type: "MURDER", consensus: { voters: 4, picks: { x: 1, y: 3 } } } as unknown as EpisodeEvent;
    expect(consensusRows(murder).map((r) => r.id)).toEqual(["y", "x"]);
    expect(consensusRows({ ...murder, consensus: { voters: 0, picks: {} } })).toEqual([]);
  });

  it("seats the first player at the far end and makes the near side bigger", () => {
    const seats = seatLayout(4);
    expect(seats[0].y).toBeLessThan(50);
    expect(seats[2].y).toBeGreaterThan(50);
    expect(seats[2].scale).toBeGreaterThan(seats[0].scale);
    // Far seats still leave a 44px tap target on a 64px seat.
    expect(Math.min(...seatLayout(24).map((s) => s.scale)) * 64).toBeGreaterThanOrEqual(44);
  });

  it("fits a small cast on a phone and widens the table for a big one", () => {
    expect(tableWidth(8)).toBe(320);
    expect(tableWidth(22)).toBeGreaterThan(400);
    expect(tableWidth(22)).toBeLessThan(tableWidth(30));
  });
});
