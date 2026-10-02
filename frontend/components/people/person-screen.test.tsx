import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { search, replace } = vi.hoisted(() => ({ search: { value: new URLSearchParams("id=jenna-dewan") }, replace: vi.fn() }));
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
  bio: { title: "Jenna Dewan", url: "https://en.wikipedia.org/wiki/Jenna_Dewan", description: "American actress", extract: "Jenna Dewan is an actress." },
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
    { season: "dwts-20", number: 20, role: "celebrity", loaded: false, partners: [], result: null },
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

  it("says how to see a season's result, and offers unscored seasons", async () => {
    render(<PersonScreen />);
    const seasons = await screen.findByRole("region", { name: "Seasons" });
    expect(href(within(seasons).getByRole("link", { name: /Finish episode 4/ }))).toBe("/episode?season=dwts-35&ep=04");
    fireEvent.click(within(seasons).getByRole("button", { name: /Season 20/ }));
    expect(replace).toHaveBeenCalledWith("/people/?id=jenna-dewan&season=dwts-20", { scroll: false });
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
});
