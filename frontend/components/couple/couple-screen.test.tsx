import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: new URLSearchParams("id=amber-glenn") }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/couples/couple/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => nav.search,
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/people")>()),
  getPerson: vi.fn(),
  getPersonBrief: vi.fn(),
}));

import { ApiError } from "@armchair/app-core/api/client";
import { getPerson, getPersonBrief, type OpenRow, type PerformanceRow, type PersonPage, type SeasonResult } from "@/lib/api/people";
import { getSeason, type Season } from "@/lib/api/show";
import { CoupleScreen } from "./couple-screen";

const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [
    { ep: 2, week: 1, airDate: "2026-09-15", start: "20:00", end: "22:00", theme: "Premiere" },
    { ep: 3, week: 2, airDate: "2026-09-22", start: "20:00", end: "22:00", theme: null },
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: "Yacht Rock" },
  ],
  judges: [
    { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
    { id: "derek-hough", name: "Derek Hough", headshot: null },
  ],
  contestants: [
    {
      id: "amber-glenn",
      keyword: "amber",
      members: [
        { name: "Pasha Pashkov", role: "pro", headshot: null },
        { name: "Amber Glenn", role: "celebrity", headshot: null },
      ],
    },
  ],
};

const DANCERS = [
  { id: "amber-glenn", name: "Amber Glenn", role: "celebrity" as const },
  { id: "pasha-pashkov", name: "Pasha Pashkov", role: "pro" as const },
];

const open = (ep: number, week: number, style: string, judges: [number, number], mine: number | null): OpenRow => ({
  season: "dwts-35",
  ep,
  week,
  key: "amber-glenn#1",
  style,
  song: `${style} song`,
  dancers: DANCERS,
  locked: false,
  judges: [
    { id: "carrie-ann-inaba", value: judges[0], state: "confirmed" },
    { id: "derek-hough", value: judges[1], state: "confirmed" },
  ],
  panelMean: (judges[0] + judges[1]) / 2,
  mine: mine === null ? null : { value: mine },
  friends: { count: 2, mean: 8 },
  everyone: { count: 6, mean: 7.5 },
});
const LOCKED: PerformanceRow = { season: "dwts-35", ep: 4, week: 3, key: "amber-glenn#1", style: "Jive", song: null, dancers: DANCERS, locked: true };

const page = (result: SeasonResult | null, performances: PerformanceRow[]): PersonPage => ({
  id: "amber-glenn",
  name: "Amber Glenn",
  roles: ["celebrity"],
  headshot: null,
  bio: null,
  facts: null,
  seasons: [{ season: "dwts-35", number: 35, role: "celebrity", loaded: true, partners: [{ id: "pasha-pashkov", name: "Pasha Pashkov" }], result }],
  performances,
  judged: null,
  stats: { dancer: null, judge: null },
});

const PASHA: PersonPage = {
  ...page(null, []),
  id: "pasha-pashkov",
  name: "Pasha Pashkov",
  roles: ["pro"],
  seasons: [
    { season: "dwts-30", number: 30, role: "pro", loaded: false, partners: [{ id: "melora-hardin", name: "Melora Hardin" }], result: null, place: 6, cast: 15 },
    { season: "dwts-33", number: 33, role: "pro", loaded: false, partners: [{ id: "chandler-kinney", name: "Chandler Kinney" }], result: null, place: 3, cast: 13 },
    { season: "dwts-35", number: 35, role: "pro", loaded: false, partners: [{ id: "amber-glenn", name: "Amber Glenn" }], result: null },
  ],
};

beforeEach(() => {
  nav.search = new URLSearchParams("id=amber-glenn");
  vi.mocked(getPersonBrief).mockResolvedValue(PASHA);
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getPerson).mockResolvedValue(
    page({ locked: true, season: "dwts-35", ep: 4 }, [open(2, 1, "Cha-cha", [7, 8], 9), open(3, 2, "Tango", [8, 8], 6), LOCKED]),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CoupleScreen", () => {
  it("heads the page with both of them, celebrity first, each linking to their page", async () => {
    render(<CoupleScreen />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Amber Glenn & Pasha Pashkov");
    expect(within(heading).getByRole("link", { name: "Pasha Pashkov" }).getAttribute("href")).toMatch(/^\/people\/?\?id=pasha-pashkov$/);
    expect(getPerson).toHaveBeenCalledWith("amber-glenn", "dwts-35");
  });

  it("hides the result until the caller finishes the episode it was decided in", async () => {
    render(<CoupleScreen />);
    expect(await screen.findByText("Result hidden")).toBeTruthy();
    // One beside the result, one in the timeline's nudge.
    const links = screen.getAllByRole("link", { name: "Score week 3" });
    expect(links).toHaveLength(2);
    for (const a of links) expect(a.getAttribute("href")).toMatch(/^\/episode\/?\?season=dwts-35&ep=04$/);
    expect(screen.queryByText(/Eliminated/)).toBeNull();
  });

  it("sums up the season and its standout dances", async () => {
    render(<CoupleScreen />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByText("1 still to score")).toBeTruthy();
    const notes = screen.getByRole("region", { name: "Notes" });
    expect(notes.textContent).toContain("Judges' bestTango · Week 2");
    expect(notes.textContent).toContain("Your favoriteCha-cha · Week 1");
    expect(notes.textContent).toContain("Where you splitTango · Week 2");
  });

  it("charts you against the judges and lays every dance out as a grid, gated ones as a nudge", async () => {
    render(<CoupleScreen />);
    const chart = await screen.findByRole("img", { name: /W1 Cha-cha you 9, judges 7.5; W2 Tango you 6, judges 8/ });
    expect(chart.querySelectorAll("polyline")).toHaveLength(2);
    const dances = screen.getByRole("region", { name: "Every dance" });
    const grid = within(dances).getByRole("list", { name: "Dances, night by night" });
    const cells = within(grid).getAllByRole("listitem").filter((li) => li.parentElement === grid);
    expect(cells.map((c) => c.querySelector("p")?.textContent)).toEqual(["Week 1 · Premiere", "Week 2", "To see week 3 scores, score it first"]);
    expect(within(cells[0]).getByRole("heading", { level: 3 }).textContent).toBe("Cha-cha");
    expect(within(dances).getAllByRole("list", { name: "Judges' scores" })[0].textContent).toBe("Carrie7Derek8");
  });

  it("is one column on a phone, two from 30rem and three on a wide desktop", async () => {
    render(<CoupleScreen />);
    const grid = await screen.findByRole("list", { name: "Dances, night by night" });
    expect(grid.className.split(" ")).toEqual(expect.arrayContaining(["grid-cols-1", "min-[30rem]:grid-cols-2", "xl:grid-cols-3"]));
    // A lone nudge spans the pair of columns it would otherwise leave half empty.
    const nudge = within(grid).getByText("To see week 3 scores, score it first").closest("li")!;
    expect(nudge.className).toContain("min-[30rem]:col-span-2");
    const partnership = screen.getByRole("region", { name: "Partnership" }).querySelector("dl")!;
    expect(partnership.className.split(" ")).toEqual(expect.arrayContaining(["grid-cols-2", "sm:grid-cols-4", "lg:grid-cols-2"]));
  });

  it("jumps to a night from the rail, which shows the judges' best or a lock", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<CoupleScreen />);
    const rail = await screen.findByRole("navigation", { name: "Jump to a night" });
    const stops = within(rail).getAllByRole("button");
    expect(stops.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Week 1, judges' best 7.5",
      "Week 2, judges' best 8.0",
      "Week 3, still to score",
    ]);
    fireEvent.click(stops[1]);
    expect(stops[1].getAttribute("aria-current")).toBe("true");
    expect(document.activeElement?.id).toBe("night-3");
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("opens with who they are, quick facts and the partnership in numbers", async () => {
    vi.mocked(getPerson).mockResolvedValue({
      ...page({ locked: true, season: "dwts-35", ep: 4 }, [open(2, 1, "Cha-cha", [7, 8], 9), open(3, 2, "Tango", [10, 8], 6), LOCKED]),
      bio: { title: "Amber Glenn", url: "", description: "American figure skater (born 1999)", extract: "" },
      category: "Athlete",
    });
    render(<CoupleScreen />);
    const overview = await screen.findByRole("region", { name: "Overview" });
    await within(overview).findByText(/3rd season as a pro/);
    expect(overview.querySelector("p")?.textContent).toBe(
      "Amber Glenn is an American figure skater. This is Pasha Pashkov's 3rd season as a pro, after partnering Chandler Kinney and Melora Hardin. Best finish before this: 3rd of 13 with Chandler Kinney in Season 33.",
    );
    expect(within(overview).getByRole("link", { name: "Melora Hardin" }).getAttribute("href")).toMatch(/^\/people\/?\?id=melora-hardin$/);
    expect(getPersonBrief).toHaveBeenCalledWith("pasha-pashkov");
    const facts = within(overview).getByRole("list", { name: "Quick facts" });
    expect(within(facts).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Season 35",
      "Athlete",
      "Pro's 3rd season",
      "2 previous partners",
      "Best dance: Tango 9",
    ]);
    const numbers = screen.getByRole("region", { name: "Partnership" });
    expect(numbers.textContent).toContain("Nights together");
    expect(numbers.textContent).toContain("Perfect 10s");
  });

  it("names a past season's finish, and still shows the overview when the pro won't load", async () => {
    nav.search = new URLSearchParams("id=amber-glenn&season=dwts-34");
    vi.mocked(getSeason).mockResolvedValue({ ...SEASON, season: "dwts-34", open: true });
    vi.mocked(getPersonBrief).mockRejectedValue(new Error("Network down"));
    const past = page({ status: "finalist" }, []);
    past.seasons = [{ ...past.seasons[0], season: "dwts-34", number: 34, place: 2, cast: 14 }];
    vi.mocked(getPerson).mockResolvedValue(past);
    render(<CoupleScreen />);
    const facts = await screen.findByRole("list", { name: "Quick facts" });
    expect(within(facts).getByText("Runner-up")).toBeTruthy();
    expect(screen.queryByText(/season as a pro/)).toBeNull();
  });

  it("stamps a couple the caller knows went home", async () => {
    vi.mocked(getPerson).mockResolvedValue(page({ status: "out", ep: 3, week: 2 }, [open(2, 1, "Cha-cha", [7, 8], 9), open(3, 2, "Tango", [8, 8], 6)]));
    render(<CoupleScreen />);
    expect(await screen.findByText("Went home in week 2.")).toBeTruthy();
    expect(screen.getByText("Eliminated").parentElement?.textContent).toBe("Eliminated · Week 2");
  });

  it("says when a couple is still dancing", async () => {
    vi.mocked(getPerson).mockResolvedValue(page({ status: "dancing" }, []));
    render(<CoupleScreen />);
    expect(await screen.findByText("Still dancing")).toBeTruthy();
    expect(screen.getByText("Nothing danced yet")).toBeTruthy();
  });

  it("carries a past season through to its reads", async () => {
    nav.search = new URLSearchParams("id=amber-glenn&season=dwts-34");
    vi.mocked(getSeason).mockResolvedValue({ ...SEASON, season: "dwts-34", open: true });
    render(<CoupleScreen />);
    await screen.findByRole("heading", { level: 1 });
    expect(getSeason).toHaveBeenCalledWith("dwts-34");
    expect(getPerson).toHaveBeenCalledWith("amber-glenn", "dwts-34");
  });

  it("finds no couple for an id outside the season's roster", async () => {
    nav.search = new URLSearchParams("id=derek-hough");
    render(<CoupleScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "No couple here" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Every couple" }).getAttribute("href")).toMatch(/^\/couples\/?$/);
  });

  it("finds no couple for an id people_get doesn't know", async () => {
    nav.search = new URLSearchParams("id=nobody");
    vi.mocked(getPerson).mockRejectedValue(new ApiError(404, "No such person"));
    render(<CoupleScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "No couple here" })).toBeTruthy();
  });

  it("retries after a failed load", async () => {
    vi.mocked(getPerson).mockRejectedValueOnce(new Error("Network down"));
    render(<CoupleScreen />);
    expect(await screen.findByText("Could not load this couple: Network down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
  });
});
