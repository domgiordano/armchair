import { describe, expect, it } from "vitest";

import type { EpisodeResults } from "@/lib/api/show";
import { bonusGroups } from "@/lib/show/bonus";

const results = (extra: Partial<EpisodeResults>): EpisodeResults => ({
  eliminated: [],
  totals: {},
  bonus: {},
  ...extra,
});

describe("bonusGroups", () => {
  it("lists a marathon in finishing order and keeps a dance-off's pairs as the page has them", () => {
    const groups = bonusGroups(
      results({
        segments: [
          { label: "Hustle Marathon", contestants: ["ada"], points: 1, text: null },
          { label: "Dance-off", contestants: ["bo"], points: null, text: "Winners" },
          { label: "Hustle Marathon", contestants: ["cy"], points: 5, text: null },
          { label: "Dance-off", contestants: ["di"], points: null, text: "Losers" },
        ],
      }),
    );
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.contestants[0])])).toEqual([
      ["Hustle Marathon", ["cy", "ada"]],
      ["Dance-off", ["bo", "di"]],
    ]);
  });

  it("falls back to the per-couple bonus, and to nothing", () => {
    expect(bonusGroups(results({ bonus: { ada: 2, bo: 9 } }))).toEqual([
      {
        label: "Bonus points",
        rows: [
          { contestants: ["bo"], points: 9, text: null },
          { contestants: ["ada"], points: 2, text: null },
        ],
      },
    ]);
    expect(bonusGroups(results({}))).toEqual([]);
  });
});
