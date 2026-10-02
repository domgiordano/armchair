import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CoupleSummary } from "@/lib/api/couples";
import { eliminatedLast, highlights, readShowEliminated, useShowEliminated } from "./eliminated";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("Show eliminated", () => {
  it("is on for leaderboards and off for stats until flipped", () => {
    expect(readShowEliminated("week-board")).toBe(true);
    expect(readShowEliminated("standings")).toBe(true);
    expect(readShowEliminated("performers")).toBe(false);
    expect(readShowEliminated("favorites")).toBe(false);
  });

  it("remembers each view's choice on its own", () => {
    const { result } = renderHook(() => useShowEliminated("performers"));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(readShowEliminated("performers")).toBe(true);
    expect(readShowEliminated("favorites")).toBe(false);

    const board = renderHook(() => useShowEliminated("week-board"));
    act(() => board.result.current[1](false));
    expect(renderHook(() => useShowEliminated("week-board")).result.current[0]).toBe(false);
  });

  it("falls back to the default, and still flips, when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useShowEliminated("standings"));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});

describe("eliminatedLast", () => {
  const rows = [
    { id: "a", out: true },
    { id: "b", out: false },
    { id: "c", out: true },
    { id: "d", out: false },
  ];
  const out = (r: { out: boolean }) => r.out;

  it("keeps everyone's order and moves the eliminated to the end", () => {
    expect(eliminatedLast(rows, out, true).map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("drops them when hidden", () => {
    expect(eliminatedLast(rows, out, false).map((r) => r.id)).toEqual(["b", "d"]);
  });
});

describe("highlights", () => {
  const couple = (id: string, you: number, gap: number | null): CoupleSummary => ({
    ref: `dwts-35/${id}`,
    id,
    season: "dwts-35",
    members: [],
    dances: 1,
    you,
    judges: gap === null ? null : you - gap,
    judged: 1,
    gap,
    absGap: gap === null ? null : Math.abs(gap),
    friends: { mean: null, raters: 0 },
    everyone: { mean: null, raters: 0 },
    eliminated: null,
  });
  const ids = (cs: CoupleSummary[]) => cs.map((c) => c.id);

  it("matches performers_get: top three, the rest lowest first, and the widest gaps each way", () => {
    const h = highlights([couple("a", 9, 2), couple("b", 8, -1), couple("c", 7, 0), couple("d", 6, -3), couple("e", 5, 1)]);
    expect(ids(h.favorites)).toEqual(["a", "b", "c"]);
    expect(ids(h.leastFavorites)).toEqual(["e", "d"]);
    expect(ids(h.softerOn)).toEqual(["a", "e"]);
    expect(ids(h.tougherOn)).toEqual(["d", "b"]);
  });
});
