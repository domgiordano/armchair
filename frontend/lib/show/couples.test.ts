import { describe, expect, it } from "vitest";

import type { BoardRow, CoupleStats } from "@/lib/api/couples";
import { boardOrder, gapTone, movement, ordinal, signed, sortCouples } from "./couples";
import { personSlug } from "./people";

const couple = (ref: string, you: number, gap: number | null, friends: number | null = null): CoupleStats => ({
  ref,
  id: ref,
  season: "dwts-35",
  members: [],
  dances: 1,
  you,
  judges: gap === null ? null : you - gap,
  judged: gap === null ? 0 : 1,
  gap,
  absGap: gap === null ? null : Math.abs(gap),
  friends: { mean: friends, raters: friends === null ? 1 : 2 },
  everyone: { mean: null, raters: 0 },
  eliminated: null,
  best: { ep: 1, week: 1, key: `${ref}#1`, style: null, paddle: you, judges: null },
  worst: { ep: 1, week: 1, key: `${ref}#1`, style: null, paddle: you, judges: null },
  weeks: [],
});

const row = (id: string, ranks: Partial<BoardRow["ranks"]>): BoardRow => ({
  id,
  members: [],
  dances: 1,
  styles: [],
  you: 7,
  judges: 7,
  judgesTotal: 21,
  friends: null,
  everyone: null,
  ranks: { judges: null, you: null, friends: null, everyone: null, ...ranks },
  rankDelta: null,
});

describe("sortCouples", () => {
  const all = [couple("a", 6, -2, 7), couple("b", 9, 1), couple("c", 8, null, 9)];

  it("sorts by your average, highest first", () => {
    expect(sortCouples(all, "you").map((c) => c.ref)).toEqual(["b", "c", "a"]);
  });

  it("puts the most over the judges first, and couples with no gap last", () => {
    expect(sortCouples(all, "over").map((c) => c.ref)).toEqual(["b", "a", "c"]);
    expect(sortCouples(all, "under").map((c) => c.ref)).toEqual(["a", "b", "c"]);
  });

  it("sends couples with no friends' average to the end", () => {
    expect(sortCouples(all, "friends").map((c) => c.ref)).toEqual(["c", "a", "b"]);
  });
});

describe("gapTone and signed", () => {
  it.each([
    [0.8, "over"],
    [-0.5, "under"],
    [0.2, "level"],
    [null, "level"],
  ] as const)("%s reads %s", (gap, tone) => {
    expect(gapTone(gap)).toBe(tone);
  });

  it("signs a gap with one decimal", () => {
    expect([signed(0.8), signed(-1.26), signed(0), signed(-0.03), signed(0.04)]).toEqual(["+0.8", "−1.3", "0.0", "0.0", "0.0"]);
  });
});

describe("boardOrder and movement", () => {
  const rows = [row("x", { judges: 2, you: 3 }), row("y", { judges: 3, you: 1 }), row("z", { judges: 1, you: null })];

  it("orders by one column, unranked last", () => {
    expect(boardOrder(rows, "judges").map((r) => r.id)).toEqual(["z", "x", "y"]);
    expect(boardOrder(rows, "you").map((r) => r.id)).toEqual(["y", "x", "z"]);
  });

  it("counts places gained against the judges, or against you on the judges' ranking", () => {
    expect(movement(rows[1], "you")).toBe(2);
    expect(movement(rows[0], "you")).toBe(-1);
    expect(movement(rows[1], "judges")).toBe(-2);
    expect(movement(rows[2], "you")).toBeNull();
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [22, "22nd"],
  ])("%i is %s", (n, s) => {
    expect(ordinal(n)).toBe(s);
  });
});

describe("personSlug", () => {
  it.each([
    ["Pasha Pashkov", "pasha-pashkov"],
    ["Harry Shum Jr.", "harry-shum-jr"],
    ["Carrie Ann Inaba", "carrie-ann-inaba"],
    ["Shaquille O'Neal", "shaquille-oneal"],
    ["Gleb Savchenko", "gleb-savchenko"],
    ["Beyoncé Knowles", "beyonce-knowles"],
  ])("%s is %s", (name, slug) => {
    expect(personSlug(name)).toBe(slug);
  });
});
