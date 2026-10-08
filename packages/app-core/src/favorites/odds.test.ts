import { describe, expect, it } from "vitest";

import { moveLabel, percent, sourceLabel, trend } from "./odds";

describe("odds helpers", () => {
  it("never shows a long shot as 0%", () => {
    expect(percent(0.004)).toBe("<1%");
    expect(percent(0.224)).toBe("22%");
  });

  it("reads movement by place first, then by points", () => {
    expect(trend(null)).toBeNull();
    expect(moveLabel({ rank: 2, chance: 0.05 })).toBe("Up 2 places");
    expect(moveLabel({ rank: -1, chance: 0.05 })).toBe("Down 1 place");
    expect(moveLabel({ rank: 0, chance: -0.03 })).toBe("Down 3 points");
    expect(moveLabel({ rank: 0, chance: 0.004 })).toBe("No change");
  });

  it("labels the model when there is no market", () => {
    expect(sourceLabel({ market: null })).toBe("Armchair odds (model)");
    const market = { source: "Polymarket", url: "https://polymarket.com/event/x", capturedAt: "2026-10-06T19:00:00Z" };
    expect(sourceLabel({ market }, "America/New_York")).toBe("Odds via Polymarket as of Oct 6, 3:00 PM");
  });
});
