import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: new URLSearchParams(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/couples/",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => nav.search,
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/couples", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/couples")>()),
  getPerformers: vi.fn(),
}));
vi.mock("@/lib/api/overview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/overview")>()),
  getOverview: vi.fn(),
}));
vi.mock("@/lib/api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/people")>()),
  getPerson: vi.fn(),
}));
vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getPerformers, type CoupleStats, type Elimination, type Performers } from "@/lib/api/couples";
import { getMyGroups } from "@armchair/app-core/api/groups";
import { getOverview, type CoupleStanding, type Overview } from "@/lib/api/overview";
import { getPerson, type PersonPage } from "@/lib/api/people";
import { getSeason, type Member, type Season } from "@/lib/api/show";
import { CouplesScreen } from "../couples-screen";

const pair = (celebrity: string, pro: string): Member[] => [
  { name: celebrity, role: "celebrity", headshot: null },
  { name: pro, role: "pro", headshot: null },
];
const CAST = {
  "tyler-cameron": pair("Tyler Cameron", "Sharna Burgess"),
  "amber-glenn": pair("Amber Glenn", "Pasha Pashkov"),
  "jenna-dewan": pair("Jenna Dewan", "Val Chmerkovskiy"),
  "ezra-frech": pair("Ezra Frech", "Daniella Karagach"),
};
type Id = keyof typeof CAST;

const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [{ ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: null }],
  judges: [],
  contestants: Object.entries(CAST).map(([id, members]) => ({ id, keyword: id, members })),
};

const standing = (id: Id, average: number | null, eliminated: Elimination | null = null): CoupleStanding => ({
  id,
  members: CAST[id],
  dances: average === null ? 0 : 2,
  average,
  eliminated,
});

const overview = (couples: CoupleStanding[]): Overview => ({
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  judges: [],
  progress: { aired: 3, total: 10, couples: 4, couplesLeft: 4 },
  me: { scored: 4, count: 4, mae: 1, closestJudge: null, streak: 1 },
  next: null,
  episodes: [],
  reveals: [],
  couples,
});

const mine = (id: Id, you: number, judges: number): CoupleStats => {
  const dance = { ep: 4, week: 3, key: `${id}#1`, style: "Tango", paddle: you, judges };
  return {
    ref: `dwts-35/${id}`,
    id,
    season: "dwts-35",
    members: CAST[id],
    dances: 1,
    you,
    judges,
    judged: 1,
    gap: you - judges,
    absGap: Math.abs(you - judges),
    friends: { mean: null, raters: 0 },
    everyone: { mean: null, raters: 0 },
    eliminated: null,
    best: dance,
    worst: dance,
    weeks: [dance],
  };
};

const PERFORMERS: Performers = {
  sub: "me",
  season: "dwts-35",
  group: null,
  couples: [mine("tyler-cameron", 9, 8), mine("amber-glenn", 5, 6.5)],
  pros: [],
  celebrities: [],
  styles: [],
  favorites: [],
  leastFavorites: [],
  softerOn: [],
  tougherOn: [],
};

const person = (id: string): PersonPage => ({
  id,
  name: id,
  roles: ["celebrity"],
  headshot: null,
  bio: null,
  facts: null,
  seasons: [],
  performances: [
    {
      season: "dwts-35",
      ep: 4,
      week: 3,
      key: `${id}#1`,
      style: "Foxtrot",
      song: null,
      dancers: [],
      locked: false,
      judges: [],
      panelMean: 8.5,
      mine: null,
      friends: { count: 0, mean: null },
      everyone: { count: 0, mean: null },
    },
    { season: "dwts-35", ep: 5, week: 4, key: `${id}#1`, style: "Jive", song: null, dancers: [], locked: true },
  ],
  judged: null,
  stats: { dancer: null, judge: null },
});

beforeEach(() => {
  nav.search = new URLSearchParams();
  window.localStorage.clear();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getOverview).mockResolvedValue(
    overview([
      standing("tyler-cameron", 8),
      standing("amber-glenn", 6.5),
      standing("jenna-dewan", 9, { ep: 4, week: 3 }),
      standing("ezra-frech", null),
    ]),
  );
  vi.mocked(getPerformers).mockResolvedValue(PERFORMERS);
  vi.mocked(getPerson).mockImplementation((id) => Promise.resolve(person(id)));
  vi.mocked(getMyGroups).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

const rows = () =>
  within(screen.getByRole("list", { name: "Couples" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("Couples roster", () => {
  it("lists every couple on the roster by default, with no comparison and no group picker", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(rows()).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Off", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "List", selected: true })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Compare with" })).toBeNull();
    expect(getPerformers).toHaveBeenCalledWith("dwts-35", null);
  });

  it("shows a couple you haven't scored, with a nudge in place of the judges' marks", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    const ezra = rows().find((r) => r?.includes("Ezra Frech"));
    expect(ezra).toContain("Score to see the judges' marks");
    expect(rows()[0]).toContain("Judges 8.0 · You 9.0");
  });

  it("orders by the judges, then the eliminated last and stamped, and the switch hides them", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(rows().map((r) => r?.match(/Tyler Cameron|Amber Glenn|Ezra Frech|Jenna Dewan/)?.[0])).toEqual(["Tyler Cameron", "Amber Glenn", "Ezra Frech", "Jenna Dewan"]);
    expect(rows()[3]).toContain("Eliminated · Week 3");

    const toggle = screen.getByRole("switch", { name: "Show eliminated" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(rows()).toHaveLength(3);
    expect(window.localStorage.getItem("armchair.showEliminated.couples")).toBe("0");
  });

  it("stamps nobody the gate hasn't told the caller about", async () => {
    vi.mocked(getOverview).mockResolvedValue(overview([standing("tyler-cameron", 8), standing("jenna-dewan", 9)]));
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(rows()).toHaveLength(4);
    expect(screen.queryByText("Eliminated")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Show eliminated" })).toBeNull();
  });

  it("links every row to the couple's page", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    const link = screen.getByRole("link", { name: /^Ezra Frech & Daniella Karagach/ });
    expect(link.getAttribute("href")).toMatch(/^\/couples\/couple\/?\?id=ezra-frech&season=dwts-35$/);
  });

  it("switches layout and turns on a comparison through the URL", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    fireEvent.click(screen.getByRole("tab", { name: "Cards" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/couples/?view=cards", { scroll: false });
    fireEvent.click(screen.getByRole("tab", { name: "Week" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/couples/?compare=week", { scroll: false });
  });

  it("shows the season comparison with its group picker when asked", async () => {
    nav.search = new URLSearchParams("compare=season");
    render(<CouplesScreen />);
    expect(await screen.findByRole("heading", { name: /Every couple you've scored/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Cards" })).toBeNull();
    expect(screen.getByRole("link", { name: "Start a group to compare with friends" })).toBeTruthy();
  });
});

describe("Couples cards", () => {
  beforeEach(() => {
    nav.search = new URLSearchParams("view=cards");
  });

  const slides = () => [...screen.getByRole("list", { name: /Swipe or use the arrow keys/ }).children] as HTMLElement[];
  const current = () => screen.getByRole("list", { name: /Swipe or use the arrow keys/ }).querySelector("[aria-current]")?.getAttribute("aria-label");

  it("shows one couple a card, current first, and loads dances for it and its neighbour only", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("region", { name: "Couples" });
    expect(current()).toBe("1 of 4: Tyler Cameron & Sharna Burgess");
    expect(await screen.findAllByText("Judges' best:")).toHaveLength(2);
    expect(vi.mocked(getPerson).mock.calls.map(([id]) => id)).toEqual(["tyler-cameron", "amber-glenn"]);
    expect(screen.getByRole("button", { name: "Previous couple" })).toHaveProperty("disabled", true);
  });

  it("moves with the buttons, the arrow keys and the dots", async () => {
    render(<CouplesScreen />);
    const carousel = await screen.findByRole("region", { name: "Couples" });

    fireEvent.click(screen.getByRole("button", { name: "Next couple" }));
    expect(current()).toBe("2 of 4: Amber Glenn & Pasha Pashkov");
    expect(screen.getByText("Couple 2 of 4: Amber Glenn & Pasha Pashkov")).toBeTruthy();

    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(current()).toBe("3 of 4: Ezra Frech & Daniella Karagach");
    fireEvent.keyDown(carousel, { key: "End" });
    expect(current()).toBe("4 of 4: Jenna Dewan & Val Chmerkovskiy");
    expect(screen.getByRole("button", { name: "Next couple" })).toHaveProperty("disabled", true);

    fireEvent.click(within(screen.getByRole("list", { name: "Pick a couple" })).getByRole("button", { name: "Amber Glenn" }));
    expect(current()).toBe("2 of 4: Amber Glenn & Pasha Pashkov");
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(current()).toBe("1 of 4: Tyler Cameron & Sharna Burgess");
  });

  it("follows a swipe: the card nearest the middle once scrolling settles becomes current", async () => {
    render(<CouplesScreen />);
    const scroller = await screen.findByRole("list", { name: /Swipe or use the arrow keys/ });
    [...scroller.children].forEach((li, i) => {
      Object.defineProperty(li, "offsetLeft", { value: i * 300 });
      Object.defineProperty(li, "offsetWidth", { value: 280 });
    });
    Object.defineProperty(scroller, "clientWidth", { value: 390 });
    // The middle sits at 695: nearest the third card's centre, 740.
    scroller.scrollLeft = 500;

    fireEvent.scroll(scroller);
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(current()).toBe("3 of 4: Ezra Frech & Daniella Karagach");
    expect(slides()).toHaveLength(4);
  });

  it("stamps an eliminated couple's card and gives an unscored one the nudge", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("region", { name: "Couples" });
    const cards = slides();
    expect(cards[3].textContent).toContain("Eliminated · Week 3");
    expect(cards[2].textContent).toContain("Score to see the judges' marks");
    expect(cards[0].textContent).toContain("Dancing");
  });
});
