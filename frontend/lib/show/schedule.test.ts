import { afterEach, describe, expect, it } from "vitest";

import type { Episode } from "@/lib/api/show";
import { episodeLabel, formatAirDate, hasAired, isLive, latestAired, zonedInstant } from "./schedule";

const TZ = "America/New_York";
const ep = (n: number, week: number, airDate: string): Episode => ({
  ep: n,
  week,
  airDate,
  start: "20:00",
  end: "22:00",
  theme: null,
});
const EPISODES = [ep(1, 1, "2026-09-15"), ep(2, 1, "2026-09-16"), ep(3, 2, "2026-09-22"), ep(6, 5, "2026-10-13"), ep(8, 7, "2026-11-02")];
const OCT13 = EPISODES[3];
const NOV2 = EPISODES[4];
const at = (iso: string) => Date.parse(iso);
const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("zonedInstant", () => {
  it("reads 8 pm on Tue 10/13 as Eastern daylight time", () => {
    expect(zonedInstant("2026-10-13", "20:00", TZ)).toBe(at("2026-10-14T00:00:00Z"));
  });

  it("reads 8 pm on Mon 11/2 as Eastern standard time, the day after DST ends", () => {
    expect(zonedInstant("2026-11-02", "20:00", TZ)).toBe(at("2026-11-03T01:00:00Z"));
  });

  it("gives the same instant on a Pacific-time device", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(zonedInstant("2026-10-13", "20:00", TZ)).toBe(at("2026-10-14T00:00:00Z"));
    expect(new Date(at("2026-10-14T00:00:00Z")).getHours()).toBe(17);
  });
});

describe("air window", () => {
  it("opens scoring at the ET start, not before", () => {
    expect(hasAired(OCT13, TZ, at("2026-10-13T23:59:59Z"))).toBe(false);
    expect(hasAired(OCT13, TZ, at("2026-10-14T00:00:00Z"))).toBe(true);
  });

  it("stays live half an hour past the end for late judges' scores", () => {
    expect(isLive(OCT13, TZ, at("2026-10-13T23:59:00Z"))).toBe(false);
    expect(isLive(OCT13, TZ, at("2026-10-14T00:00:00Z"))).toBe(true);
    expect(isLive(OCT13, TZ, at("2026-10-14T02:29:00Z"))).toBe(true);
    expect(isLive(OCT13, TZ, at("2026-10-14T02:30:00Z"))).toBe(false);
  });

  it("uses the standard-time offset on 11/2", () => {
    expect(isLive(NOV2, TZ, at("2026-11-03T00:30:00Z"))).toBe(false);
    expect(isLive(NOV2, TZ, at("2026-11-03T01:30:00Z"))).toBe(true);
  });
});

describe("latestAired", () => {
  it("picks the last episode that has started in ET", () => {
    expect(latestAired(EPISODES, TZ, at("2026-10-13T23:00:00Z")).ep).toBe(3);
    expect(latestAired(EPISODES, TZ, at("2026-10-14T00:01:00Z")).ep).toBe(6);
  });

  it("falls back to the premiere before the season starts", () => {
    expect(latestAired(EPISODES, TZ, at("2026-09-01T00:00:00Z")).ep).toBe(1);
  });
});

describe("labels", () => {
  it("names nights only when a week has two", () => {
    expect(episodeLabel(EPISODES[0], EPISODES)).toBe("Week 1, night 1");
    expect(episodeLabel(EPISODES[1], EPISODES)).toBe("Week 1, night 2");
    expect(episodeLabel(OCT13, EPISODES)).toBe("Week 5");
  });

  it("formats the air date without shifting it a day on a western device", () => {
    process.env.TZ = "Pacific/Honolulu";
    expect(formatAirDate("2026-10-13")).toBe("Tue, Oct 13");
  });
});

describe("an untimed past-season episode", () => {
  const past: Episode = { ep: 1, week: 1, airDate: null, start: null, end: null, theme: null };

  it("has aired, is never live, and has no date to show", () => {
    expect(hasAired(past, TZ, 0)).toBe(true);
    expect(isLive(past, TZ, at("2026-09-16T01:00:00Z"))).toBe(false);
    expect(formatAirDate(null)).toBeNull();
  });
});
