import { describe, expect, it } from "vitest";

import type { SeasonEpisode } from "@/lib/api/traitors";

import { countdown, defaultEpisode, isLive, latestUnlocked, nextRelease, toCall, unfinishedBefore } from "./schedule";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const ep = (n: number, releaseAt: string, answered: number, extra: Partial<SeasonEpisode> = {}): SeasonEpisode => ({
  ep: n,
  title: null,
  releaseAt,
  closed: false,
  events: 3,
  answered,
  ...extra,
});

// 1-2 closed before launch; 3 done; 4 half done; 5 untouched; 6 not out yet.
const SEASON = [
  ep(1, "2026-09-18T00:00:00Z", 0, { closed: true, events: 2 }),
  ep(2, "2026-09-25T00:00:00Z", 0, { closed: true }),
  ep(3, "2026-10-02T00:00:00Z", 3),
  ep(4, "2026-10-09T00:00:00Z", 1),
  ep(5, "2026-10-16T00:00:00Z", 0),
  ep(6, "2026-10-23T00:00:00Z", 0),
];

describe("schedule", () => {
  it("counts down in the two largest units", () => {
    expect(countdown(2 * 86_400_000 + 4 * 3_600_000 + 5 * 60_000)).toBe("2d 4h");
    expect(countdown(3 * 3_600_000 + 12 * 60_000)).toBe("3h 12m");
    expect(countdown(12 * 60_000 + 30_000)).toBe("12m");
    expect(countdown(30_000)).toBe("now");
    expect(countdown(-5)).toBe("now");
  });

  it("lists released open episodes still to call, never closed or future ones", () => {
    expect(toCall(SEASON, NOW).map((e) => e.ep)).toEqual([4, 5]);
    expect(unfinishedBefore(SEASON, 5, NOW).map((e) => e.ep)).toEqual([4]);
    expect(unfinishedBefore(SEASON, 4, NOW)).toEqual([]);
  });

  it("finds the next release and the newest results you may see", () => {
    expect(nextRelease(SEASON, NOW)?.ep).toBe(6);
    expect(latestUnlocked(SEASON, NOW)?.ep).toBe(3);
  });

  it("opens the oldest episode still to call, else the newest out", () => {
    expect(defaultEpisode(SEASON, NOW)?.ep).toBe(4);
    const done = SEASON.map((e) => ({ ...e, answered: e.events }));
    expect(defaultEpisode(done, NOW)?.ep).toBe(5);
    expect(defaultEpisode([], NOW)).toBeNull();
  });

  it("is live from an hour before a release to six hours after", () => {
    const at = "2026-10-16T12:00:00Z";
    expect(isLive(at, NOW - 59 * 60_000)).toBe(true);
    expect(isLive(at, NOW - 61 * 60_000)).toBe(false);
    expect(isLive(at, NOW + 6 * 3_600_000)).toBe(true);
    expect(isLive(at, NOW + 6 * 3_600_000 + 1)).toBe(false);
  });
});
