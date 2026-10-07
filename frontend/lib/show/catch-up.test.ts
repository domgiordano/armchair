import { describe, expect, it } from "vitest";

import type { Overview, OverviewEpisode } from "@/lib/api/overview";
import { skipTarget, unfinishedBefore } from "./catch-up";

const ep = (n: number, extra: Partial<OverviewEpisode>): OverviewEpisode => ({
  ep: n,
  week: n,
  theme: null,
  airDate: "2026-09-15",
  startsAt: "2026-09-16T00:00:00Z",
  endsAt: "2026-09-16T02:00:00Z",
  aired: true,
  rateable: 10,
  answered: 10,
  ...extra,
});

const overview = (episodes: OverviewEpisode[], next: Overview["next"] = null) => ({ episodes, next }) as Overview;

describe("unfinishedBefore", () => {
  const eps = [ep(1, { answered: 3 }), ep(2, {}), ep(3, { answered: 0 }), ep(4, { aired: false, rateable: undefined })];

  it("lists aired episodes before the one given with dances left, oldest first", () => {
    expect(unfinishedBefore(overview(eps), 4).map((e) => e.ep)).toEqual([1, 3]);
    expect(unfinishedBefore(overview(eps), 3).map((e) => e.ep)).toEqual([1]);
    expect(unfinishedBefore(overview(eps), 1)).toEqual([]);
  });

  it("lets a closed episode's missed dances go: the API returns it complete", () => {
    const closed = [ep(1, { answered: 3, complete: true }), ep(2, { answered: 4 })];
    expect(unfinishedBefore(overview(closed), 3).map((e) => e.ep)).toEqual([2]);
  });

  it("does not count an episode with nothing rateable as unfinished", () => {
    expect(unfinishedBefore(overview([ep(1, { rateable: 0, answered: 0 })]), 2)).toEqual([]);
  });
});

describe("skipTarget", () => {
  const eps = [ep(1, {}), ep(2, {}), ep(3, {})];
  const next = { ep: 3, week: 3, theme: null, airDate: "2026-09-29", startsAt: "2026-09-30T00:00:00Z" };

  it("stops before the episode given while the season is on", () => {
    expect(skipTarget(overview(eps, next), 2)).toBe(2);
  });

  it("runs past the last episode once nothing is left to air", () => {
    expect(skipTarget(overview(eps), 2)).toBe(4);
  });
});
