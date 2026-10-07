import { describe, expect, it } from "vitest";

import type { Overview, OverviewEpisode } from "@/lib/api/overview";
import { scoreTarget } from "./score-target";

const ep = (n: number, over: Partial<OverviewEpisode> = {}): OverviewEpisode => ({
  ep: n,
  week: n,
  theme: null,
  airDate: `2026-10-0${n}`,
  startsAt: `2026-10-0${n}T00:00:00Z`,
  endsAt: `2026-10-0${n}T02:00:00Z`,
  aired: false,
  ...over,
});

const overview = (episodes: OverviewEpisode[], over: Partial<Overview> = {}) =>
  ({ open: false, episodes, next: null, ...over }) as Overview;

describe("scoreTarget", () => {
  it("is the latest episode to have started, with your progress", () => {
    const o = overview([
      ep(1, { aired: true, rateable: 8, answered: 8, complete: true }),
      ep(2, { aired: true, rateable: 8, answered: 3, complete: false }),
      ep(3),
    ]);
    expect(scoreTarget(o, Date.parse("2026-10-02T12:00:00Z"))).toMatchObject({
      kind: "score",
      episode: { ep: 2 },
      live: false,
      answered: 3,
      rateable: 8,
    });
  });

  it("turns live at showtime, before the overview knows the episode aired", () => {
    const o = overview([ep(1, { aired: true, rateable: 8, answered: 8, complete: true }), ep(2)]);
    expect(scoreTarget(o, Date.parse("2026-10-02T00:30:00Z"))).toMatchObject({
      kind: "score",
      episode: { ep: 2 },
      live: true,
      answered: null,
      rateable: null,
    });
  });

  it("is done once every dance is scored, naming the next show", () => {
    const next = { ep: 2, week: 2, theme: null, airDate: "2026-10-01", startsAt: "2026-10-02T00:00:00Z" };
    const o = overview([ep(1, { aired: true, rateable: 8, answered: 8, complete: true }), ep(2)], { next });
    expect(scoreTarget(o, Date.parse("2026-10-01T12:00:00Z"))).toMatchObject({ kind: "done", episode: { ep: 1 }, next });
  });

  it("is upcoming before the premiere, and nothing on a past season", () => {
    const next = { ep: 1, week: 1, theme: null, airDate: "2026-09-30", startsAt: "2026-10-01T00:00:00Z" };
    expect(scoreTarget(overview([ep(1)], { next }), Date.parse("2026-09-01T00:00:00Z"))).toEqual({ kind: "upcoming", next });
    expect(scoreTarget(overview([ep(1, { aired: true })], { open: true }), Date.now())).toBeNull();
  });
});
