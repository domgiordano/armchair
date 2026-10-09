import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/overview", () => ({ getOverview: vi.fn() }));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getEpisodeState: vi.fn(),
}));

import type { Elimination } from "@/lib/api/couples";
import { getOverview, type Overview, type OverviewEpisode } from "@/lib/api/overview";
import { getEpisodeState, type Card, type EpisodeState, type Member, type Season } from "@/lib/api/show";
import { seal } from "@/lib/show/sealed";
import { board, dancesOf, highlights, loadBoard, revealedThrough, type Dance } from "./couples-board";

const member = (name: string): Member => ({ name, role: "celebrity", headshot: null });
const ROSTER = ["Ava", "Bo", "Cy", "Di"].map((n) => ({ id: n.toLowerCase(), members: [member(n), { name: `${n}'s pro`, role: "pro" as const, headshot: null }] }));

const others = (...values: number[]) => values.map((value, i) => ({ sub: `u${i}`, value }));
const dance = (couple: string, week: number, score: number, extra: Partial<Dance> = {}): Dance => ({
  couple,
  ep: week + 1,
  week,
  style: "Tango",
  score,
  perfect: score === 10,
  others: [],
  ...extra,
});

// Week 1: Ava 8, Bo 7, Cy 7, Di 5. Week 2: Ava 7, Bo 9, Cy 6; Di didn't dance and went home that week.
const DANCES = [
  dance("ava", 1, 8),
  dance("bo", 1, 7),
  dance("cy", 1, 7),
  dance("di", 1, 5),
  dance("ava", 2, 7, { style: "Jive" }),
  dance("bo", 2, 10, { style: "Waltz" }),
  dance("cy", 2, 6),
];
const OUTS = new Map<string, Elimination>([["di", { ep: 3, week: 2 }]]);
const names = (rows: { members: Member[] }[]) => rows.map((r) => r.members[0].name);
const opts = { roster: ROSTER, dances: DANCES, outs: OUTS, week: 2, by: "average" as const, showOut: true };

describe("board", () => {
  it("ranks by the judges' average, ties sharing a place, then the eliminated last and unranked", () => {
    const rows = board(opts);
    expect(names(rows)).toEqual(["Bo", "Ava", "Cy", "Di"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, null]);
    expect(rows[0]).toMatchObject({ average: 8.5, last: 10, lastStyles: ["Waltz"], best: 10, dances: 2, perfect: 1, trend: 3 });
    expect(rows[3].eliminated).toEqual({ ep: 3, week: 2 });
  });

  it("shares a place on a tie and skips the next", () => {
    const rows = board({ ...opts, week: 1 });
    expect(rows.map((r) => [r.members[0].name, r.rank])).toEqual([
      ["Ava", 1],
      ["Bo", 2],
      ["Cy", 2],
      ["Di", 4],
    ]);
  });

  it("moves each couple against the same sort a week earlier", () => {
    const rows = board(opts);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.move]))).toEqual({ bo: 1, ava: -1, cy: -1, di: null });
    expect(board({ ...opts, week: 1 }).every((r) => r.move === null)).toBe(true);
  });

  it("keeps a couple dancing on the board until the week they went home", () => {
    const week1 = board({ ...opts, week: 1 });
    expect(week1.find((r) => r.id === "di")).toMatchObject({ eliminated: null, rank: 4 });
    expect(names(board({ ...opts, showOut: false }))).toEqual(["Bo", "Ava", "Cy"]);
  });

  it("re-sorts by this week's score, leaving couples who didn't dance it unranked by name", () => {
    const rows = board({ ...opts, outs: new Map(), by: "last" });
    expect(rows.map((r) => [r.members[0].name, r.rank])).toEqual([
      ["Bo", 1],
      ["Ava", 2],
      ["Cy", 3],
      ["Di", null],
    ]);
  });

  it("averages the crowd only over two raters or more, with its gap to the judges", () => {
    const crowd = [dance("ava", 1, 8, { others: others(9, 9) }), dance("bo", 1, 7, { others: others(6) }), dance("cy", 1, 7)];
    const rows = board({ ...opts, dances: crowd, week: 1, by: "crowd" });
    expect(rows[0]).toMatchObject({ id: "ava", crowd: 9, delta: 1, rank: 1 });
    expect(rows.find((r) => r.id === "bo")).toMatchObject({ crowd: null, delta: null, rank: null });
  });

  it("ranks by trend, perfect scores and dances", () => {
    expect(names(board({ ...opts, by: "trend", showOut: false }))).toEqual(["Bo", "Ava", "Cy"]);
    expect(board({ ...opts, by: "perfect" }).map((r) => r.rank)).toEqual([1, 2, 2, null]);
    expect(board({ ...opts, by: "dances" }).filter((r) => r.rank === 1)).toHaveLength(3);
  });
});

describe("highlights", () => {
  it("names the judges' top three, the biggest climber and faller, and the best dance so far", () => {
    const h = highlights({ roster: ROSTER, dances: DANCES, outs: OUTS, week: 2 });
    expect(names(h.podium)).toEqual(["Bo", "Ava", "Cy"]);
    expect(h.climber?.id).toBe("bo");
    expect(h.faller?.id).toBe("ava");
    expect(h.top).toMatchObject({ couple: "bo", score: 10, week: 2 });
  });

  it("has no movers in week one, nor a dance from a later week", () => {
    const h = highlights({ roster: ROSTER, dances: DANCES, outs: OUTS, week: 1 });
    expect([h.climber, h.faller]).toEqual([null, null]);
    expect(h.top).toMatchObject({ couple: "ava", score: 8 });
  });
});

const episode = (ep: number, week: number, complete: boolean | undefined, aired = true): OverviewEpisode =>
  ({ ep, week, theme: `Theme ${week}`, airDate: null, startsAt: null, endsAt: null, aired, complete }) as OverviewEpisode;

describe("revealedThrough", () => {
  const none = () => false;
  it("needs every night of a week, and every week before it, complete", () => {
    const eps = [episode(1, 1, true), episode(2, 1, true), episode(3, 2, true), episode(4, 3, false), episode(5, 4, true)];
    expect(revealedThrough(eps, none)).toBe(2);
    expect(revealedThrough([episode(1, 1, true), episode(2, 1, false)], none)).toBeNull();
    expect(revealedThrough([episode(1, 1, undefined, false)], none)).toBeNull();
  });

  it("holds the board before a week with a sealed dance", () => {
    const eps = [episode(1, 1, true), episode(2, 2, true)];
    expect(revealedThrough(eps, (ep) => ep === 2)).toBe(1);
  });
});

const judges = (...values: (number | null)[]) =>
  values.map((value, i) => ({ id: `j${i}`, value, state: value === null ? ("pending" as const) : ("confirmed" as const) }));
const card = (key: string, extra: Partial<Card> = {}): Card =>
  ({
    key,
    contestants: [key.split("#")[0]],
    n: 1,
    style: "Jive",
    song: null,
    locked: false,
    judges: judges(8, 9, 10),
    mine: { value: 8 },
    others: others(7, 8),
    aggregate: { count: 3, mean: 7.67 },
    ...extra,
  }) as Card;
const state = (ep: number, week: number, cards: Card[], eliminated?: string[]): EpisodeState =>
  ({ season: "dwts-35", ep, week, airDate: null, theme: null, panel: [], open: false, rateable: cards.length, answered: cards.length, complete: true, performances: cards, eliminated }) as EpisodeState;

describe("dancesOf", () => {
  it("keeps a single couple's dance with a confirmed panel, and leaves out locked, team and unconfirmed ones", () => {
    const got = dancesOf(
      state(5, 4, [
        card("ava#1"),
        card("bo#1", { judges: judges(10, 10, 10) }),
        card("cy#1", { judges: judges(8, null, 9) }),
        card("ava+bo#1", { contestants: ["ava", "bo"] }),
        { key: "di#1", contestants: ["di"], n: 1, style: null, song: null, locked: true },
      ]),
    );
    expect(got).toEqual([
      { couple: "ava", ep: 5, week: 4, style: "Jive", score: 9, perfect: false, others: others(7, 8) },
      { couple: "bo", ep: 5, week: 4, style: "Jive", score: 10, perfect: true, others: others(7, 8) },
    ]);
  });
});

describe("loadBoard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const SEASON = { season: "dwts-35" } as Season;
  const overview = (episodes: OverviewEpisode[]) => ({ season: "dwts-35", episodes }) as Overview;

  it("reads only the episodes the viewer has revealed, so a later night's elimination never loads", async () => {
    vi.mocked(getOverview).mockResolvedValue(overview([episode(1, 1, true), episode(2, 1, true), episode(3, 2, false)]));
    vi.mocked(getEpisodeState).mockImplementation(async (_s, ep) => state(ep, 1, [card(ep === 1 ? "ava#1" : "bo#1")], ep === 2 ? ["di"] : []));
    const data = await loadBoard(SEASON);
    expect(vi.mocked(getEpisodeState).mock.calls.map((c) => c[1])).toEqual([1, 2]);
    expect(data.through).toBe(1);
    expect(data.weeks).toEqual([{ week: 1, theme: "Theme 1", lastEp: 2 }]);
    expect(data.dances.map((d) => d.couple)).toEqual(["ava", "bo"]);
    expect([...data.outs]).toEqual([["di", { ep: 2, week: 1 }]]);
    expect(data.next).toEqual({ ep: 3, week: 2, sealed: false });
  });

  it("reads nothing before week one is finished", async () => {
    vi.mocked(getOverview).mockResolvedValue(overview([episode(1, 1, false)]));
    const data = await loadBoard(SEASON);
    expect(getEpisodeState).not.toHaveBeenCalled();
    expect(data).toMatchObject({ through: null, dances: [], next: { ep: 1, week: 1, sealed: false } });
  });

  it("stops before an episode with a dance sealed on this device", async () => {
    seal("dwts-35", 2, "bo#1");
    vi.mocked(getOverview).mockResolvedValue(overview([episode(1, 1, true), episode(2, 2, true)]));
    vi.mocked(getEpisodeState).mockResolvedValue(state(1, 1, [card("ava#1")]));
    const data = await loadBoard(SEASON);
    expect(vi.mocked(getEpisodeState).mock.calls.map((c) => c[1])).toEqual([1]);
    expect(data.next).toEqual({ ep: 2, week: 2, sealed: true });
  });
});
