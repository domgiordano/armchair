import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { search, replace } = vi.hoisted(() => ({
  search: { value: new URLSearchParams("id=jenna-dewan") },
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/people/",
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => search.value,
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/people")>()),
  getPerson: vi.fn(),
}));

import { ApiError } from "@armchair/app-core/api/client";
import { getPerson, type OpenRow, type PersonPage, type PerformanceRow } from "@/lib/api/people";
import { nights } from "./person-dances";
import { PersonScreen } from "./person-screen";

const DANCERS = [
  { id: "jenna-dewan", name: "Jenna Dewan", role: "celebrity" as const },
  { id: "val-chmerkovskiy", name: "Val Chmerkovskiy", role: "pro" as const },
];
const base = (ep: number, week: number, style: string) => ({
  season: "dwts-35",
  ep,
  week,
  key: "jenna-dewan#1",
  style,
  song: null,
  dancers: DANCERS,
});
const OPEN: OpenRow = {
  ...base(2, 1, "Cha-cha"),
  locked: false,
  judges: [
    { id: "carrie-ann-inaba", value: 7, state: "confirmed" },
    { id: "derek-hough", value: 8, state: "confirmed" },
  ],
  panelMean: 7.5,
  mine: { value: 9 },
  friends: { count: 2, mean: 8.5 },
  everyone: { count: 10, mean: 7.9 },
};
const LOCKED: PerformanceRow = { ...base(4, 3, "Jive"), locked: true };

const PAGE: PersonPage = {
  id: "jenna-dewan",
  name: "Jenna Dewan",
  roles: ["celebrity"],
  headshot: null,
  bio: {
    title: "Jenna Dewan",
    url: "https://en.wikipedia.org/wiki/Jenna_Dewan",
    description: "American actress",
    extract: "Jenna Dewan is an actress.",
  },
  facts: { born: "1980-12-03", died: null, occupations: ["actor"], nationality: ["United States"] },
  seasons: [
    {
      season: "dwts-35",
      number: 35,
      role: "celebrity",
      loaded: true,
      partners: [{ id: "val-chmerkovskiy", name: "Val Chmerkovskiy" }],
      result: { locked: true, season: "dwts-35", ep: 4 },
      dances: 2,
      locked: 1,
    },
    {
      season: "dwts-20",
      number: 20,
      role: "celebrity",
      loaded: false,
      partners: [{ id: "derek-hough", name: "Derek Hough" }],
      result: null,
      place: 4,
      cast: 12,
    },
  ],
  category: "Actor",
  similar: [
    {
      id: "julia-stiles",
      name: "Julia Stiles",
      headshot: null,
      season: 35,
      category: "Actor",
      reasons: ["category", "cast"],
    },
    {
      id: "jennie-garth",
      name: "Jennie Garth",
      headshot: null,
      season: 5,
      category: "Actor",
      reasons: ["category", "finish"],
    },
  ],
  performances: [OPEN, LOCKED],
  judged: null,
  stats: {
    dancer: {
      dances: 2,
      locked: 1,
      judges: { count: 1, mean: 7.5 },
      best: { season: "dwts-35", ep: 2, week: 1, style: "Cha-cha", panelMean: 7.5 },
      mine: { count: 1, mean: 9, gap: 1.5 },
      friends: { count: 2, mean: 8.5 },
      everyone: { count: 10, mean: 7.9 },
    },
    judge: null,
  },
};

beforeEach(() => {
  // A function returned from beforeEach runs as cleanup, so this returns nothing.
  vi.mocked(getPerson).mockResolvedValue(PAGE);
});
afterEach(() => {
  vi.clearAllMocks();
  search.value = new URLSearchParams("id=jenna-dewan");
});

const href = (el: HTMLElement) => el.getAttribute("href")?.replace(/\/(?=\?|$)/, "");

describe("nights", () => {
  it("groups by season and night, naming a second night in the same week", () => {
    const rows = [{ ...LOCKED, ep: 2, week: 1 }, { ...LOCKED, ep: 1, week: 1 }, LOCKED];
    expect(nights(rows)[0].nights.map((n) => n.label)).toEqual(["Week 1, night 1", "Week 1, night 2", "Week 3"]);
  });
});

describe("PersonScreen", () => {
  it("shows the bio with its Wikipedia credit", async () => {
    render(<PersonScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Jenna Dewan" })).toBeTruthy();
    expect(getPerson).toHaveBeenCalledWith("jenna-dewan", undefined);
    expect(screen.getByText("Born December 3, 1980 · United States")).toBeTruthy();
    const credit = screen.getByRole("link", { name: /From Wikipedia/ });
    expect(credit.getAttribute("href")).toBe(PAGE.bio!.url);
  });

  it("shows answered dances and folds a locked week into a nudge to go score it", async () => {
    render(<PersonScreen />);
    const dances = await screen.findByRole("region", { name: "Season 35" });
    const card = within(dances).getByRole("article");
    expect(within(card).getByText("Cha-cha")).toBeTruthy();
    expect(within(card).getByText("9")).toBeTruthy();
    expect(within(card).getByText("8.5")).toBeTruthy();
    expect(within(dances).getByText("To see week 3 scores, score it first")).toBeTruthy();
    expect(href(within(dances).getByRole("link", { name: "Score week 3" }))).toBe("/episode?season=dwts-35&ep=04");
    // Nothing of the locked dance but its style.
    expect(within(dances).queryByText("Jive")).toBeTruthy();
  });

  it("lists each partnership newest first, each card opening that season's couple page", async () => {
    render(<PersonScreen />);
    const couples = await screen.findByRole("region", { name: "Danced with" });
    const [now, then] = within(couples).getAllByRole("article");
    // The current season's result waits on the episode rule; no place leaks in.
    expect(href(within(now).getByRole("link", { name: /Finish episode 4/ }))).toBe("/episode?season=dwts-35&ep=04");
    expect(within(now).queryByText(/of \d+|Won|Runner-up|Out/)).toBeNull();
    expect(href(within(now).getByRole("link", { name: "Val Chmerkovskiy" }))).toBe("/people?id=val-chmerkovskiy");
    expect(href(within(now).getByRole("link", { name: /Their season/ }))).toBe(
      "/couples/couple?id=jenna-dewan&season=dwts-35",
    );
    expect(within(then).getByText("4th of 12")).toBeTruthy();
    expect(href(within(then).getByRole("link", { name: /Their season: Season 20 with Derek Hough/ }))).toBe(
      "/couples/couple?id=jenna-dewan&season=dwts-20",
    );
  });

  it("lists similar celebrities with why, each opening their page", async () => {
    render(<PersonScreen />);
    const similar = await screen.findByRole("region", { name: "Similar celebrities" });
    const links = within(similar).getAllByRole("link");
    // Initials stand in for a missing headshot.
    expect(links.map((a) => [a.textContent, href(a)])).toEqual([
      ["JSJulia StilesSeason 35ActorSame season", "/people?id=julia-stiles"],
      ["JGJennie GarthSeason 5ActorSimilar finish", "/people?id=jennie-garth"],
    ]);
  });

  it("sums up a pro's run: seasons, partners, titles and each finish", async () => {
    search.value = new URLSearchParams("id=witney-carson");
    vi.mocked(getPerson).mockResolvedValue({
      ...PAGE,
      id: "witney-carson",
      name: "Witney Carson",
      roles: ["pro"],
      similar: null,
      category: null,
      seasons: [
        {
          season: "dwts-19",
          number: 19,
          role: "pro",
          loaded: false,
          partners: [{ id: "alfonso-ribeiro", name: "Alfonso Ribeiro" }],
          result: null,
          place: 1,
          cast: 13,
        },
        {
          season: "dwts-20",
          number: 20,
          role: "pro",
          loaded: false,
          partners: [{ id: "riker-lynch", name: "Riker Lynch" }],
          result: null,
          place: 2,
          cast: 12,
        },
        {
          season: "dwts-35",
          number: 35,
          role: "pro",
          loaded: true,
          partners: [{ id: "dylan-efron", name: "Dylan Efron" }],
          result: { status: "dancing" },
        },
      ],
    });
    render(<PersonScreen />);
    const couples = await screen.findByRole("region", { name: "Partners over the years" });
    expect(within(couples).getByRole("list", { name: "Their run" }).textContent).toBe(
      "3 seasons3 partners1 title2 top-three finishes",
    );
    expect(
      within(couples)
        .getAllByRole("article")
        .map((a) => within(a).getAllByRole("link")[0].textContent),
    ).toEqual(["Dylan Efron", "Riker Lynch", "Alfonso Ribeiro"]);
    expect(within(couples).getByText("Won the season")).toBeTruthy();
    expect(within(couples).getByText("Still dancing")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Similar celebrities" })).toBeNull();
  });

  it("answers an unknown id with a way back to Discover", async () => {
    vi.mocked(getPerson).mockRejectedValue(new ApiError(404, "No such person"));
    render(<PersonScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "No one here" })).toBeTruthy();
    expect(href(within(screen.getByRole("main")).getByRole("link", { name: "Discover" }))).toBe("/discover");
  });

  it("shows a failed load with a retry", async () => {
    vi.mocked(getPerson).mockRejectedValueOnce(new Error("Network down"));
    render(<PersonScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Jenna Dewan" })).toBeTruthy();
  });

  it("lists a judge's nights for the picked season", async () => {
    search.value = new URLSearchParams("id=derek-hough&season=dwts-35");
    vi.mocked(getPerson).mockResolvedValue({
      ...PAGE,
      id: "derek-hough",
      name: "Derek Hough",
      roles: ["judge"],
      seasons: [{ season: "dwts-35", number: 35, role: "judge", loaded: true, dances: 1, locked: 0 }],
      performances: [],
      judged: { season: "dwts-35", rows: [OPEN] },
      stats: { dancer: null, judge: null },
    });
    render(<PersonScreen />);
    const judged = await screen.findByRole("region", { name: "Dances they judged" });
    expect(within(judged).getByText("Them")).toBeTruthy();
    expect(within(judged).getByRole("link", { name: "Jenna Dewan" })).toBeTruthy();
    expect(getPerson).toHaveBeenCalledWith("derek-hough", "dwts-35");
  });

  it("lists every season judged with the couple they scored highest, and opens one not yet read", async () => {
    search.value = new URLSearchParams("id=derek-hough");
    const judge = {
      dances: 1,
      locked: 0,
      count: 1,
      mean: 8,
      panelMean: 7,
      vsPanel: 1,
      harshest: [],
      generous: [],
      byStyle: [],
      bySeason: [{ season: "dwts-35", count: 3, mean: 8, top: { dancers: DANCERS, mean: 8.5, count: 2 } }],
      distribution: { "8": 1 },
      mine: { count: 0, gap: null, mae: null },
    };
    vi.mocked(getPerson).mockResolvedValue({
      ...PAGE,
      id: "derek-hough",
      name: "Derek Hough",
      roles: ["judge"],
      similar: null,
      seasons: [
        { season: "dwts-34", number: 34, role: "judge", loaded: false },
        { season: "dwts-35", number: 35, role: "judge", loaded: true, dances: 3, locked: 0 },
      ],
      performances: [],
      judged: { season: "dwts-35", rows: [OPEN] },
      stats: { dancer: null, judge },
    });
    render(<PersonScreen />);
    const seasons = await screen.findByRole("region", { name: "Seasons judged" });
    const [s35, s34] = within(seasons).getAllByRole("listitem");
    expect(s35.textContent).toContain("Scored highest");
    expect(href(within(s35).getByRole("link", { name: "Jenna Dewan" }))).toBe("/people?id=jenna-dewan");
    expect(href(within(s35).getByRole("link", { name: /Their season/ }))).toBe(
      "/couples/couple?id=jenna-dewan&season=dwts-35",
    );
    fireEvent.click(within(s34).getByRole("button", { name: "Open Season 34" }));
    expect(replace).toHaveBeenCalledWith("/people/?id=derek-hough&season=dwts-34", { scroll: false });
  });

  it("says a guest judge is one, and for which week", async () => {
    search.value = new URLSearchParams("id=cheryl-burke");
    vi.mocked(getPerson).mockResolvedValue({
      ...PAGE,
      id: "cheryl-burke",
      name: "Cheryl Burke",
      roles: ["judge"],
      similar: null,
      seasons: [{ season: "dwts-34", number: 34, role: "judge", loaded: true, dances: 9, locked: 9, guest: true, weeks: [7] }],
      performances: [],
      judged: { season: "dwts-34", rows: [] },
      stats: { dancer: null, judge: null },
    });
    render(<PersonScreen />);
    await screen.findByRole("heading", { level: 1, name: "Cheryl Burke" });
    expect(screen.getAllByText("Guest judge").length).toBeGreaterThan(0);
    expect(screen.getByText("Guest judge, week 7, Season 34")).toBeTruthy();
    const seasons = screen.getByRole("region", { name: "Seasons judged" });
    expect(within(seasons).getByText("Guest, week 7")).toBeTruthy();
  });
});
