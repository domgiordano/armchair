import { describe, expect, it } from "vitest";

import type { RecordCall } from "@/lib/api/traitors";

import { accuracy, headToHead, mostPicked, percent, pointsOverTime } from "./record";

const rt = (ep: number, picks: string[], whys?: ("banished" | "exact" | "top3" | "miss")[], pts?: number[]): RecordCall => ({
  ep,
  type: "RT",
  picks,
  forfeit: false,
  ...(whys && pts
    ? { calls: picks.map((player, i) => ({ player, why: whys[i], points: pts[i] })), points: pts.reduce((a, b) => a + b, 0) }
    : {}),
});
const night = (ep: number, type: "MURDER" | "RECRUIT", pick: string, why?: "hit" | "miss" | "void"): RecordCall => ({
  ep,
  type,
  picks: [pick],
  forfeit: false,
  ...(why ? { calls: [{ player: pick, why, points: why === "hit" ? 4 : 0 }], points: why === "hit" ? 4 : 0 } : {}),
});

const CALLS: RecordCall[] = [
  rt(2, ["ben", "dee", "eli"], ["banished", "miss", "top3"], [5, 0, 1]),
  night(2, "MURDER", "cal", "hit"),
  night(2, "RECRUIT", "ivy", "void"),
  rt(3, ["gus", "ben", "hal"], ["miss", "miss", "exact"], [0, 0, 2]),
  night(3, "MURDER", "ben", "miss"),
  night(3, "RECRUIT", "ivy", "hit"),
  // No result yet: counts toward who you pick, not toward accuracy.
  rt(4, ["kit", "ben", "lou"]),
  { ep: 4, type: "MURDER", picks: null, forfeit: true },
];

describe("record", () => {
  it("counts who someone usually picks", () => {
    expect(mostPicked(CALLS).slice(0, 2)).toEqual([
      { player: "ben", count: 4, by: { RT: 3, MURDER: 1 } },
      { player: "ivy", count: 2, by: { RECRUIT: 2 } },
    ]);
  });

  it("rates each decision, leaving out void nights and unscored calls", () => {
    const a = accuracy(CALLS);
    expect(a.banish).toEqual({ hits: 1, of: 2 });
    expect(a.top3).toEqual({ hits: 3, of: 6 });
    expect(a.murder).toEqual({ hits: 1, of: 2 });
    expect(a.recruit).toEqual({ hits: 1, of: 1 });
    expect(percent(a.banish)).toBe(50);
    expect(percent({ hits: 0, of: 0 })).toBeNull();
  });

  it("runs points over time", () => {
    expect(pointsOverTime(CALLS, [1, 2, 3, 4])).toEqual([
      { ep: 1, points: 0, total: 0 },
      { ep: 2, points: 10, total: 10 },
      { ep: 3, points: 6, total: 16 },
      { ep: 4, points: 0, total: 16 },
    ]);
  });

  it("goes head to head only on calls both of you scored", () => {
    const theirs = [
      rt(2, ["dee", "ben", "eli"], ["miss", "top3", "top3"], [0, 1, 1]),
      night(3, "RECRUIT", "ivy", "hit"),
      night(3, "MURDER", "dee", "hit"),
    ];
    expect(headToHead(CALLS, theirs)).toEqual({ wins: 1, losses: 1, ties: 1, margin: 6 - 2 + 0 - 4 });
  });
});
