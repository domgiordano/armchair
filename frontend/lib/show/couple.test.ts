import { describe, expect, it } from "vitest";

import type { OpenRow, PerformanceRow } from "@/lib/api/people";
import { coupleTotals } from "./couple";

const row = (ep: number, panelMean: number | null, mine: OpenRow["mine"], style = "Tango"): OpenRow => ({
  season: "dwts-35",
  ep,
  week: ep - 1,
  key: "a#1",
  style,
  song: null,
  dancers: [],
  locked: false,
  judges: [],
  panelMean,
  mine,
  friends: { count: ep === 2 ? 1 : 3, mean: ep === 2 ? 6 : 8 },
  everyone: { count: 4, mean: 7 },
});
const LOCKED: PerformanceRow = { season: "dwts-35", ep: 5, week: 4, key: "a#1", style: "Jive", song: null, dancers: [], locked: true };

describe("coupleTotals", () => {
  it("averages only what the gate opened, pooling crowds by how many scored", () => {
    const t = coupleTotals([row(2, 7, { value: 9 }), row(3, 8, { value: 6 }), row(4, null, { forfeit: true }), LOCKED]);
    expect(t).toMatchObject({ dances: 4, locked: 1, judges: 7.5, judged: 2, you: 7.5, paddles: 2, gap: 0 });
    expect(t.friends).toEqual({ count: 7, mean: 7.71 });
    expect(t.everyone).toEqual({ count: 12, mean: 7 });
  });

  it("picks the judges' best and lowest, your favorite and the widest split", () => {
    const t = coupleTotals([row(2, 7, { value: 9 }, "Cha-cha"), row(3, 8.5, { value: 8 }, "Waltz"), row(4, 6, { value: 6 }, "Jive")]);
    expect(t.best?.style).toBe("Waltz");
    expect(t.worst?.style).toBe("Jive");
    expect(t.favorite?.style).toBe("Cha-cha");
    expect(t.split?.style).toBe("Cha-cha");
  });

  it("has no lowest with one judged dance, and nothing at all when every dance is gated", () => {
    expect(coupleTotals([row(2, 7, null)]).worst).toBeNull();
    expect(coupleTotals([LOCKED])).toMatchObject({ judges: null, you: null, gap: null, best: null, favorite: null, split: null });
  });
});
