import { describe, expect, it } from "vitest";

import type { BoardRow, CoupleStats, Performers, WeekBoard } from "@/lib/api/couples";
import type { Overview } from "@/lib/api/overview";
import type { OpenRow, PersonPage } from "@/lib/api/people";
import type { Profile } from "@/lib/api/profile";
import { sealBoard, sealOverview, sealPerformers, sealPerson, sealProfile } from "@/lib/show/seal-views";
import { sealsFrom } from "@/lib/show/sealed";

const S = "dwts-35";
// Ada's dance in episode 6 is locked in, judges not yet revealed.
const seals = sealsFrom([`${S}|6|ada#1`]);

describe("sealsFrom", () => {
  it("matches a dance, its couples and its night", () => {
    const team = sealsFrom([`${S}|7|ada+bo+cy#1`]);
    expect(seals.dance(S, 6, "ada#1")).toBe(true);
    expect(seals.dance(S, 5, "ada#1")).toBe(false);
    expect(team.couple(S, "bo")).toBe(true);
    expect(team.couple("dwts-34", "bo")).toBe(false);
    expect(team.episode(S, 7)).toBe(true);
  });
});

describe("sealBoard", () => {
  const row = (id: string, judges: number, you: number, rj: number, ry: number): BoardRow => ({
    id,
    members: [],
    dances: 1,
    styles: [null],
    you,
    judges,
    judgesTotal: judges * 3,
    friends: null,
    everyone: null,
    ranks: { judges: rj, you: ry, friends: null, everyone: null },
    rankDelta: rj - ry,
  });
  const board: WeekBoard = {
    season: S,
    ep: 6,
    week: 5,
    theme: null,
    panel: ["a", "b"],
    scope: "global",
    group: null,
    open: false,
    rateable: 3,
    answered: 3,
    couples: [row("ada", 10, 4, 1, 3), row("bo", 8.5, 9, 2, 1), row("cy", 7, 6, 3, 2)],
    locked: [],
    disagreements: ["ada", "cy"],
    eliminated: ["cy"],
  };

  it("blanks the sealed couple's judges and re-ranks the rest", () => {
    const out = sealBoard(board, seals);
    const [ada, bo, cy] = out.couples;
    expect(ada).toMatchObject({ judges: null, judgesTotal: null, rankDelta: null, ranks: { judges: null, you: 3 } });
    expect(bo.ranks.judges).toBe(1);
    expect(cy.ranks.judges).toBe(2);
    expect(cy.rankDelta).toBe(0);
    expect(out.disagreements).toEqual(["cy"]);
    expect(out.eliminated).toEqual([]);
    expect(out.sealed).toEqual(["ada"]);
  });

  it("leaves another night's board alone", () => {
    expect(sealBoard({ ...board, ep: 5 }, seals)).toEqual({ ...board, ep: 5 });
  });
});

describe("sealPerson", () => {
  const open: OpenRow = {
    season: S,
    ep: 6,
    week: 5,
    key: "ada#1",
    style: "Rumba",
    song: null,
    dancers: [],
    locked: false,
    writeup: { summary: "Judges loved it", judges: [], highlights: [], sources: [] },
    judges: [{ id: "a", value: 10, state: "confirmed" }],
    panelMean: 10,
    mine: { value: 4 },
    friends: { count: 0, mean: null },
    everyone: { count: 3, mean: 7 },
  };
  const page = {
    seasons: [{ season: S, number: 35, role: "celebrity", loaded: true, result: { status: "out", ep: 6, week: 5 } }],
    performances: [open, { ...open, ep: 5, key: "ada#1" }],
    judged: null,
    stats: {
      dancer: {
        dances: 2,
        locked: 0,
        judges: { count: 2, mean: 9 },
        best: { season: S, ep: 6, week: 5, style: "Rumba", panelMean: 10 },
        mine: { count: 2, mean: 5, gap: -4 },
        friends: { count: 0, mean: null },
        everyone: { count: 3, mean: 7 },
      },
      judge: null,
    },
  } as unknown as PersonPage;

  it("turns the sealed dance back into a locked row and drops what it feeds", () => {
    const out = sealPerson(page, seals);
    expect(out.performances[0]).toEqual({
      season: S,
      ep: 6,
      week: 5,
      key: "ada#1",
      style: "Rumba",
      song: null,
      dancers: [],
      locked: true,
      sealed: true,
      writeup: { locked: true },
    });
    expect(out.performances[1]).toBe(page.performances[1]);
    expect(out.stats.dancer).toMatchObject({ judges: { count: 2, mean: null }, best: null, mine: { gap: null } });
    expect(out.seasons[0].result).toEqual({ locked: true, season: S, ep: 6 });
  });
});

describe("sealProfile", () => {
  it("drops a sealed best call and blanks that week", () => {
    const call = { season: S, ep: 6, week: 5, key: "ada#1", style: null, members: [], paddle: 4, panelMean: 10, error: 6 };
    const profile = {
      detail: {
        best: { ...call, key: "bo#1", error: 0 },
        worst: call,
        weeks: [
          { season: S, ep: 5, week: 4, count: 1, mae: 1, paddle: 7, judges: 8 },
          { season: S, ep: 6, week: 5, count: 2, mae: 3, paddle: 6, judges: 9 },
        ],
      },
    } as unknown as Profile;
    const out = sealProfile(profile, seals);
    expect(out.detail.best).toBe(profile.detail.best);
    expect(out.detail.worst).toBeNull();
    expect(out.detail.weeks[0]).toBe(profile.detail.weeks[0]);
    expect(out.detail.weeks[1]).toMatchObject({ judges: null, mae: null, paddle: 6 });
  });
});

describe("sealPerformers and sealOverview", () => {
  it("hide a sealed couple's judges' average and that night's exit", () => {
    const dance = { ep: 6, week: 5, key: "ada#1", style: null, paddle: 4, judges: 10 };
    const couple = {
      ref: `${S}/ada`,
      id: "ada",
      season: S,
      judges: 9,
      gap: -4,
      absGap: 4,
      eliminated: { ep: 6, week: 5 },
      best: dance,
      worst: { ...dance, ep: 5 },
      weeks: [dance],
    } as unknown as CoupleStats;
    const p = { couples: [couple], softerOn: [], tougherOn: [`${S}/ada`] } as unknown as Performers;
    const out = sealPerformers(p, seals);
    expect(out.couples[0]).toMatchObject({ judges: null, gap: null, eliminated: null, best: { judges: null }, worst: { judges: 10 } });
    expect(out.couples[0].weeks[0].judges).toBeNull();
    expect(out.tougherOn).toEqual([]);

    const o = { season: S, couples: [{ id: "ada", average: 9, eliminated: { ep: 6, week: 5 } }] } as unknown as Overview;
    expect(sealOverview(o, seals).couples[0]).toMatchObject({ average: null, eliminated: null });
  });
});
