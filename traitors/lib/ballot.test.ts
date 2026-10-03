import { describe, expect, it } from "vitest";

import type { EpisodeEvent } from "@/lib/api/traitors";

import { chalk, chalkable, consensusRows, move, toggle } from "./ballot";

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

  it("chalks a name in at a rank, moves it between ranks, and rubs it out on its own rank", () => {
    expect(chalk([], "a", 0, 3)).toEqual(["a"]);
    expect(chalk(["a", "b"], "c", 0, 3)).toEqual(["c", "a", "b"]);
    expect(chalk(["a", "b"], "a", 1, 3)).toEqual(["b", "a"]);
    expect(chalk(["a", "b"], "b", 1, 3)).toEqual(["a"]);
    // A full slate: the new name takes that rank's place.
    expect(chalk(["a", "b", "c"], "d", 1, 3)).toEqual(["a", "d", "c"]);
  });

  it("fills ranks in order: no II before a I", () => {
    expect([0, 1, 2].map((r) => chalkable([], "a", r, 3))).toEqual([true, false, false]);
    expect([0, 1, 2].map((r) => chalkable(["b"], "a", r, 3))).toEqual([true, true, false]);
    expect([0, 1, 2].map((r) => chalkable(["a", "b"], "a", r, 3))).toEqual([true, true, false]);
    expect([0, 1, 2].map((r) => chalkable(["b", "c", "d"], "a", r, 3))).toEqual([true, true, true]);
  });
});
