import type { Season } from "@/lib/api/show";
import type { Call, CrowdStats, PersonStats } from "@/lib/api/stats";

export const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: "Yacht Rock" },
    { ep: 5, week: 4, airDate: "2026-10-06", start: "20:00", end: "22:00", theme: "Mariah Carey" },
  ],
  judges: [
    { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
    { id: "derek-hough", name: "Derek Hough", headshot: null },
    { id: "bruno-tonioli", name: "Bruno Tonioli", headshot: null },
  ],
  contestants: [
    { id: "tyler-cameron", keyword: "TYLER", members: [{ name: "Tyler Cameron", role: "celebrity", headshot: null }] },
    { id: "amber-glenn", keyword: "AMBER", members: [{ name: "Amber Glenn", role: "celebrity", headshot: null }] },
    { id: "jenna-dewan", keyword: "JENNA", members: [{ name: "Jenna Dewan", role: "celebrity", headshot: null }] },
  ],
};

const panel = { "carrie-ann-inaba": 7, "derek-hough": 8, "bruno-tonioli": 9 };
const call = (ep: number, couple: string, paddle: number, judges: number, style: string): Call => ({
  ep,
  week: ep - 1,
  key: `${couple}#1`,
  style,
  couples: [couple],
  paddle,
  judges,
  panel,
  gap: paddle - judges,
  error: Math.abs(paddle - judges),
});

const CALLS = [
  call(4, "amber-glenn", 6, 6, "Waltz"),
  call(4, "tyler-cameron", 10, 8, "Tango"),
  call(5, "jenna-dewan", 5, 7, "Tango"),
  call(5, "tyler-cameron", 9, 8, "Tango"),
];

const summary = { count: 4, mae: 1.25, bias: 0.25, exact: 0.25, close: 0.5 };

export const PERSON: PersonStats = {
  season: "dwts-35",
  ep: null,
  person: { sub: "a", name: "Ada Lovelace", picture: null, avatarKind: "initials" },
  episodes: [
    { ep: 4, week: 3, theme: "Yacht Rock", dances: 2 },
    { ep: 5, week: 4, theme: "Mariah Carey", dances: 2 },
  ],
  sub: "a",
  ...summary,
  paddle: 7.5,
  judges: 7.25,
  rank: 2,
  ranked: 5,
  weeks: [
    { ep: 4, week: 3, theme: "Yacht Rock", count: 2, mae: 1, bias: 1, exact: 0.5, close: 0.5, paddle: 8, judges: 7, rank: 1, ranked: 4 },
    { ep: 5, week: 4, theme: "Mariah Carey", count: 2, mae: 1.5, bias: -0.5, exact: 0, close: 0.5, paddle: 7, judges: 7.5, rank: 3, ranked: 5 },
  ],
  byJudge: [
    { id: "bruno-tonioli", count: 4, mae: 0.75, bias: -0.75 },
    { id: "derek-hough", count: 4, mae: 1.25, bias: 0.25 },
    { id: "carrie-ann-inaba", count: 4, mae: 1.75, bias: 1.25 },
  ],
  styles: [
    { style: "Waltz", count: 1, mae: 0, bias: 0, exact: 1, close: 1, paddle: 6, judges: 6 },
    { style: "Tango", count: 3, mae: 1.67, bias: 0.33, exact: 0, close: 0.33, paddle: 8, judges: 7.67 },
  ],
  couples: [
    { id: "tyler-cameron", count: 2, mae: 1.5, bias: 1.5, exact: 0, close: 0.5, paddle: 9.5, judges: 8 },
    { id: "amber-glenn", count: 1, mae: 0, bias: 0, exact: 1, close: 1, paddle: 6, judges: 6 },
    { id: "jenna-dewan", count: 1, mae: 2, bias: -2, exact: 0, close: 0, paddle: 5, judges: 7 },
  ],
  favorites: ["tyler-cameron"],
  leastFavorites: ["jenna-dewan"],
  styleLikes: ["Tango"],
  styleDislikes: [],
  streak: { current: 1, best: 1 },
  best: [CALLS[0], CALLS[3], CALLS[2]],
  worst: [CALLS[1], CALLS[2], CALLS[3]],
  distribution: Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    you: CALLS.filter((c) => c.paddle === i + 1).length,
    judges: CALLS.filter((c) => Math.floor(c.judges + 0.5) === i + 1).length,
  })),
  calls: CALLS,
  eliminated: {},
};

export const CROWD: CrowdStats = {
  season: "dwts-35",
  ep: null,
  scope: "group",
  group: "g1",
  episodes: PERSON.episodes,
  people: {
    a: { sub: "a", name: "Ada Lovelace", picture: null, avatarKind: "initials" },
    b: { sub: "b", name: "Bea Arthur", picture: null, avatarKind: "initials" },
    c: { sub: "c", name: "Cy Twombly", picture: null, avatarKind: "initials" },
  },
  count: 6,
  mae: 1,
  bias: 0.2,
  exact: 0.33,
  close: 0.67,
  raters: 3,
  weeks: [
    {
      ep: 4,
      week: 3,
      theme: "Yacht Rock",
      dances: 1,
      participants: 3,
      count: 3,
      mae: 1,
      bias: 1,
      exact: 0.33,
      close: 0.67,
      leaders: [
        { sub: "a", rank: 1, count: 1, mae: 0, bias: 0, exact: 1, close: 1 },
        { sub: "b", rank: 2, count: 1, mae: 1, bias: 1, exact: 0, close: 1 },
        { sub: "c", rank: 3, count: 1, mae: 2, bias: 2, exact: 0, close: 0 },
      ],
      standings: [
        { sub: "a", rank: 1, count: 1, mae: 0, bias: 0, exact: 1, close: 1 },
        { sub: "b", rank: 2, count: 1, mae: 1, bias: 1, exact: 0, close: 1 },
        { sub: "c", rank: 3, count: 1, mae: 2, bias: 2, exact: 0, close: 0 },
      ],
    },
    {
      ep: 5,
      week: 4,
      theme: "Mariah Carey",
      dances: 1,
      participants: 3,
      count: 3,
      mae: 1,
      bias: -0.6,
      exact: 0.33,
      close: 0.67,
      leaders: [
        { sub: "c", rank: 1, count: 1, mae: 0, bias: 0, exact: 1, close: 1 },
        { sub: "b", rank: 2, count: 1, mae: 1, bias: 1, exact: 0, close: 1 },
        { sub: "a", rank: 3, count: 1, mae: 2, bias: 2, exact: 0, close: 0 },
      ],
      standings: [
        { sub: "b", rank: 1, count: 2, mae: 1, bias: 1, exact: 0, close: 1 },
        { sub: "a", rank: 2, count: 2, mae: 1, bias: 1, exact: 0.5, close: 0.5 },
        { sub: "c", rank: 2, count: 2, mae: 1, bias: 1, exact: 0.5, close: 0.5 },
      ],
    },
  ],
  dances: [
    { ep: 4, week: 3, key: "tyler-cameron#1", style: "Tango", couples: ["tyler-cameron"], judges: 8, raters: 3, crowd: 9, spread: 0.82, delta: 1 },
    { ep: 5, week: 4, key: "tyler-cameron#1", style: "Tango", couples: ["tyler-cameron"], judges: 8, raters: 3, crowd: 7, spread: 2.16, delta: -1 },
  ],
  divisive: [
    { ep: 5, key: "tyler-cameron#1" },
    { ep: 4, key: "tyler-cameron#1" },
  ],
  couples: [
    {
      id: "tyler-cameron",
      dances: 2,
      judges: 8,
      raters: 3,
      crowd: 8,
      spread: 1.63,
      delta: 0,
      weeks: [
        { ep: 4, week: 3, dances: 1, judges: 8, raters: 3, crowd: 9, spread: 0.82, delta: 1 },
        { ep: 5, week: 4, dances: 1, judges: 8, raters: 3, crowd: 7, spread: 2.16, delta: -1 },
      ],
    },
  ],
  favorites: [],
  leastFavorites: [],
  styles: [{ style: "Tango", dances: 2, judges: 8, raters: 3, crowd: 8, spread: 1.63, delta: 0 }],
  members: [
    { sub: "b", rank: 1, count: 2, mae: 1, bias: 1, exact: 0, close: 1, favoriteStyle: "Tango", bestStyle: "Tango", favorite: "tyler-cameron", leastFavorite: null },
    { sub: "a", rank: 2, count: 2, mae: 1, bias: 1, exact: 0.5, close: 0.5, favoriteStyle: "Tango", bestStyle: "Tango", favorite: "tyler-cameron", leastFavorite: null },
    { sub: "c", rank: 2, count: 2, mae: 1, bias: 1, exact: 0.5, close: 0.5, favoriteStyle: null, bestStyle: "Tango", favorite: null, leastFavorite: null },
  ],
  headToHead: {
    a: { b: [1, 1, 0], c: [1, 1, 0] },
    b: { a: [1, 1, 0], c: [1, 1, 0] },
    c: { a: [1, 1, 0], b: [1, 1, 0] },
  },
  global: { count: 9, mae: 1.4, bias: 0.1, exact: 0.2, close: 0.5, weeks: [{ ep: 4, count: 5, mae: 1.2, bias: 0.3, exact: 0.2, close: 0.6 }, { ep: 5, count: 4, mae: 1.6, bias: -0.1, exact: 0.25, close: 0.5 }] },
  eliminated: {},
};
