import { describe, expect, it } from "vitest";

import type { EpisodeEvent } from "@/lib/api/traitors";

import { consensusRows, move, tableLayout, toggle } from "./ballot";

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

  it("keeps the head of the table for the host and seats players clockwise from its left", () => {
    const t = tableLayout(3);
    expect(t.host.x).toBeCloseTo(50);
    expect(t.host.y).toBeLessThan(t.seats[1].y);
    expect(t.seats[0].x).toBeGreaterThan(50);
    expect(t.seats[2].x).toBeLessThan(50);
  });

  it("spaces every seat at least a tap target apart, for 12 players or 22", () => {
    for (const n of [12, 22]) {
      const t = tableLayout(n);
      const px = [t.host, ...t.seats].map((s) => ({ x: (s.x * t.width) / 100, y: (s.y * t.height) / 100 }));
      const gaps = px.map((p, i) => Math.hypot(p.x - px[(i + 1) % px.length].x, p.y - px[(i + 1) % px.length].y));
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(56);
    }
  });

  it("fits twelve on a phone and widens the table for a big cast", () => {
    expect(tableLayout(12).width).toBeLessThanOrEqual(343);
    expect(tableLayout(22).width).toBeGreaterThan(tableLayout(12).width);
  });
});
