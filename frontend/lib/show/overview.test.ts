import { describe, expect, it } from "vitest";

import type { Overview, OverviewEpisode } from "@/lib/api/overview";
import { countdown, hero, shortLabel, showTime } from "./overview";

const ep = (n: number, startsAt: string, extra: Partial<OverviewEpisode> = {}): OverviewEpisode => {
  const start = Date.parse(startsAt);
  return {
    ep: n,
    week: n,
    theme: null,
    airDate: startsAt.slice(0, 10),
    startsAt,
    endsAt: new Date(start + 2 * 3600_000).toISOString(),
    aired: false,
    ...extra,
  };
};

const overview = (episodes: OverviewEpisode[], scored = 0): Overview => ({
  season: "dwts-35",
  timezone: "America/New_York",
  judges: [],
  progress: { aired: 0, total: episodes.length, couples: 16, couplesLeft: 16 },
  me: { scored, count: 0, mae: null, closestJudge: null, streak: 0 },
  next: null,
  episodes,
  reveals: [],
  couples: [],
});

const at = (iso: string) => Date.parse(iso);

describe("hero", () => {
  const e1 = ep(1, "2026-09-16T00:00:00Z", { aired: true, complete: true });
  const e2 = ep(2, "2026-09-23T00:00:00Z", { aired: true, complete: false });
  const e3 = ep(3, "2026-09-30T00:00:00Z");

  it("pushes the episode on air, through the 30 minutes after it ends", () => {
    const o = overview([e1, { ...e2, complete: true }, e3]);
    expect(hero(o, at("2026-09-30T01:00:00Z"))).toMatchObject({ kind: "live", episode: { ep: 3 } });
    expect(hero(o, at("2026-09-30T02:29:00Z")).kind).toBe("live");
    expect(hero(o, at("2026-09-30T02:31:00Z")).kind).toBe("catchUp");
  });

  it("sends a caller back to the oldest unfinished episode", () => {
    const h = hero(overview([e1, e2, { ...e3, aired: true, complete: false }], 4), at("2026-10-05T00:00:00Z"));
    expect(h).toEqual({ kind: "catchUp", episode: e2, waiting: 2, fresh: false });
  });

  it("marks a caller who has never scored as fresh", () => {
    expect(hero(overview([e2, e3]), at("2026-09-25T00:00:00Z"))).toMatchObject({ kind: "catchUp", fresh: true });
  });

  it("takes a past season's untimed episodes as aired and never live", () => {
    const past = (n: number, complete: boolean) =>
      ep(n, "2026-09-16T00:00:00Z", { airDate: null, startsAt: null, endsAt: null, aired: true, complete });
    const o = overview([past(1, true), past(2, false)]);
    expect(hero(o, at("2026-09-16T00:30:00Z"))).toMatchObject({ kind: "catchUp", episode: { ep: 2 } });
    expect(hero(overview([past(1, true)]), at("2026-09-16T00:30:00Z")).kind).toBe("wrap");
  });

  it("counts down once caught up, and wraps after the finale", () => {
    expect(hero(overview([e1, e3], 3), at("2026-09-20T00:00:00Z")).kind).toBe("upNext");
    expect(hero(overview([e1], 3), at("2026-09-20T00:00:00Z")).kind).toBe("wrap");
  });
});

describe("countdown", () => {
  it("splits a gap into days, hours, minutes and seconds", () => {
    expect(countdown(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("stops at zero", () => {
    expect(countdown(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe("labels", () => {
  it("gives showtime in Eastern", () => {
    expect(showTime("2026-10-14T00:00:00Z", "America/New_York")).toBe("8:00 PM ET");
  });

  it("numbers a second night in the same week", () => {
    const a = ep(1, "2026-09-16T00:00:00Z", { week: 1 });
    const b = ep(2, "2026-09-17T00:00:00Z", { week: 1 });
    const c = ep(3, "2026-09-23T00:00:00Z", { week: 2 });
    expect([a, b, c].map((e) => shortLabel(e, [a, b, c]))).toEqual(["W1.1", "W1.2", "W2"]);
  });
});
