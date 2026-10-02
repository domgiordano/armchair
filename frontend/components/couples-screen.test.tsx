import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: new URLSearchParams(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/couples/",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => nav.search,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/couples", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/couples")>()),
  getPerformers: vi.fn(),
  getWeekBoard: vi.fn(),
}));
vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getPerformers, getWeekBoard, type BoardRow, type CoupleStats, type Performers, type WeekBoard } from "@/lib/api/couples";
import { getMyGroups } from "@/lib/api/groups";
import { getSeason, type Member, type Season } from "@/lib/api/show";
import { CouplesScreen } from "./couples-screen";
import { choose } from "./ui/select-test-utils";

const pair = (celebrity: string, pro: string): Member[] => [
  { name: celebrity, role: "celebrity", headshot: null },
  { name: pro, role: "pro", headshot: null },
];
const TYLER = pair("Tyler Cameron", "Sharna Burgess");
const AMBER = pair("Amber Glenn", "Pasha Pashkov");
const JENNA = pair("Jenna Dewan", "Val Chmerkovskiy");

const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: "Yacht Rock" },
    { ep: 5, week: 4, airDate: "2026-10-06", start: "20:00", end: "22:00", theme: null },
  ],
  judges: [
    { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
    { id: "derek-hough", name: "Derek Hough", headshot: null },
  ],
  contestants: [],
};

const dance = (ep: number, paddle: number, judges: number | null) => ({ ep, week: ep - 1, key: "x#1", style: "Tango", paddle, judges });

const stats = (ref: string, members: Member[], you: number, judges: number, friends: number | null): CoupleStats => ({
  ref: `dwts-35/${ref}`,
  id: ref,
  season: "dwts-35",
  members,
  dances: 2,
  you,
  judges,
  judged: 2,
  gap: Math.round((you - judges) * 100) / 100,
  absGap: Math.abs(you - judges),
  friends: { mean: friends, raters: friends === null ? 1 : 3 },
  everyone: { mean: 7.4, raters: 5 },
  eliminated: null,
  best: dance(4, 9, 8),
  worst: dance(5, 7, 8),
  weeks: [dance(4, 9, 8), dance(5, 7, 8)],
});

const PERFORMERS: Performers = {
  sub: "me",
  season: "dwts-35",
  group: null,
  couples: [stats("tyler-cameron", TYLER, 8, 8, 7.5), stats("amber-glenn", AMBER, 9, 6.5, null), stats("jenna-dewan", JENNA, 6, 9, 8.5)],
  pros: [{ name: "Pasha Pashkov", headshot: null, seasons: ["dwts-35"], couples: 1, dances: 2, you: 9, judges: 6.5, judged: 2, gap: 2.5, absGap: 2.5 }],
  celebrities: [],
  styles: [],
  favorites: ["dwts-35/amber-glenn", "dwts-35/tyler-cameron", "dwts-35/jenna-dewan"],
  leastFavorites: [],
  softerOn: ["dwts-35/amber-glenn"],
  tougherOn: ["dwts-35/jenna-dewan"],
};

const boardRow = (id: string, members: Member[], you: number, judges: number, ranks: BoardRow["ranks"]): BoardRow => ({
  id,
  members,
  dances: 1,
  styles: ["Tango"],
  you,
  judges,
  judgesTotal: judges * 3,
  friends: null,
  everyone: 7,
  ranks,
  rankDelta: ranks.judges !== null && ranks.you !== null ? ranks.judges - ranks.you : null,
});

const BOARD: WeekBoard = {
  season: "dwts-35",
  open: false,
  ep: 4,
  week: 3,
  theme: "Yacht Rock",
  panel: ["carrie-ann-inaba", "derek-hough"],
  scope: "global",
  group: null,
  rateable: 4,
  answered: 3,
  couples: [
    boardRow("amber-glenn", AMBER, 9, 6, { judges: 3, you: 1, friends: null, everyone: 1 }),
    boardRow("jenna-dewan", JENNA, 6, 9, { judges: 1, you: 3, friends: null, everyone: 1 }),
    boardRow("tyler-cameron", TYLER, 8, 8, { judges: 2, you: 2, friends: null, everyone: 1 }),
  ],
  locked: [{ id: "ezra-frech", members: pair("Ezra Frech", "Daniella Karagach") }],
  disagreements: ["amber-glenn", "jenna-dewan"],
  eliminated: [],
};

beforeEach(() => {
  nav.search = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getPerformers).mockResolvedValue(PERFORMERS);
  vi.mocked(getWeekBoard).mockResolvedValue(BOARD);
  vi.mocked(getMyGroups).mockResolvedValue([]);
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

const rowNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((li) => li.querySelector("a")?.textContent);

describe("Your couples", () => {
  it("lists every couple by your average with the gap to the judges", async () => {
    render(<CouplesScreen />);
    const heading = await screen.findByRole("heading", { name: /Every couple you've scored · 3/ });
    const ol = heading.parentElement!.querySelector("ol")!;
    expect(rowNames(ol)).toEqual(["Amber Glenn", "Tyler Cameron", "Jenna Dewan"]);
    expect(within(ol).getAllByText("Over the judges by 2.5").length).toBeGreaterThan(0);
    expect(within(ol).getAllByText("Under the judges by 3.0").length).toBeGreaterThan(0);
    expect(getPerformers).toHaveBeenCalledWith("dwts-35", null);
  });

  it("links each celebrity and pro to their page", async () => {
    render(<CouplesScreen />);
    const links = await screen.findAllByRole("link", { name: "Pasha Pashkov" });
    expect(links.every((a) => a.getAttribute("href")?.replace("/?", "?") === "/people?id=pasha-pashkov")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Amber Glenn" })[0].getAttribute("href")).toMatch(/^\/people\/?\?id=amber-glenn$/);
  });

  it("highlights favorites and who you're softer and tougher on", async () => {
    render(<CouplesScreen />);
    const softer = await screen.findByRole("region", { name: "You're softer on" });
    expect(softer.textContent).toContain("Amber Glenn");
    expect(softer.textContent).toContain("+2.5");
    expect(screen.getByRole("region", { name: "You're tougher on" }).textContent).toContain("−3.0");
    expect(screen.getByRole("region", { name: "Least favorites" }).textContent).toContain("Score a few more couples.");
  });

  it("re-sorts by the gap", async () => {
    render(<CouplesScreen />);
    const heading = await screen.findByRole("heading", { name: /Every couple/ });
    choose(screen.getByRole("combobox", { name: "Sort by" }), "You score lower");
    expect(rowNames(heading.parentElement!.querySelector("ol")!)).toEqual(["Jenna Dewan", "Tyler Cameron", "Amber Glenn"]);
  });

  it("asks for every season", async () => {
    render(<CouplesScreen />);
    choose(await screen.findByRole("combobox", { name: "Seasons" }), "Every season");
    await vi.waitFor(() => expect(getPerformers).toHaveBeenLastCalledWith("all", null));
  });

  it("opens a couple's sheet with their week-by-week chart", async () => {
    render(<CouplesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Details for Amber Glenn & Pasha Pashkov" }));
    const sheet = screen.getByRole("dialog", { name: "Amber Glenn & Pasha Pashkov" });
    expect(sheet.textContent).toContain("You overrate them by 2.5 a dance against the judges.");
    const chart = within(sheet).getByRole("img", { name: /W3 you 9, judges 8; W4 you 7, judges 8/ });
    expect(chart.querySelectorAll("polyline")).toHaveLength(2);
    expect(within(sheet).getByText("need 2")).toBeTruthy();
  });

  describe("with an eliminated couple", () => {
    const OUT = { ep: 5, week: 4 };
    beforeEach(() => {
      vi.mocked(getPerformers).mockResolvedValue({
        ...PERFORMERS,
        couples: PERFORMERS.couples.map((c) => (c.id === "amber-glenn" ? { ...c, eliminated: OUT } : c)),
      });
    });

    it("leaves them out of your stats by default, highlights refilled from who's left", async () => {
      render(<CouplesScreen />);
      const heading = await screen.findByRole("heading", { name: /Every couple you've scored · 2/ });
      expect(rowNames(heading.parentElement!.querySelector("ol")!)).toEqual(["Tyler Cameron", "Jenna Dewan"]);
      expect(screen.getByRole("switch", { name: "Show eliminated" }).getAttribute("aria-checked")).toBe("false");
      expect(screen.getByRole("region", { name: "You're softer on" }).textContent).toContain("Nobody yet");
      expect(screen.queryByText("Eliminated")).toBeNull();
    });

    it("shows them last, stamped, once switched on, and remembers it", async () => {
      render(<CouplesScreen />);
      fireEvent.click(await screen.findByRole("switch", { name: "Show eliminated" }));
      // Amber is first on your average and still goes to the bottom.
      const heading = screen.getByRole("heading", { name: /Every couple you've scored · 3/ });
      const rows = within(heading.parentElement!.querySelector("ol")!).getAllByRole("listitem");
      expect(rows.map((li) => li.querySelector("a")?.textContent)).toEqual(["Tyler Cameron", "Jenna Dewan", "Amber Glenn"]);
      expect(rows[2].textContent).toContain("Eliminated · Week 4");
      expect(window.localStorage.getItem("armchair.showEliminated.performers")).toBe("1");
    });

    it("still opens their sheet, with a way to every dance", async () => {
      window.localStorage.setItem("armchair.showEliminated.performers", "1");
      render(<CouplesScreen />);
      fireEvent.click(await screen.findByRole("button", { name: "Details for Amber Glenn & Pasha Pashkov" }));
      const sheet = screen.getByRole("dialog", { name: "Amber Glenn & Pasha Pashkov" });
      expect(sheet.textContent).toContain("Eliminated · Week 4");
      const link = within(sheet).getByRole("link", { name: /Every dance/ });
      expect(link.getAttribute("href")).toMatch(/^\/people\/?\?id=amber-glenn&season=dwts-35$/);
    });
  });

  it("nudges to score when there's nothing yet", async () => {
    vi.mocked(getPerformers).mockResolvedValue({ ...PERFORMERS, couples: [], pros: [], favorites: [], softerOn: [], tougherOn: [] });
    render(<CouplesScreen />);
    expect(await screen.findByText("No couples to compare yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Score a dance" }).getAttribute("href")).toMatch(/^\/episode\/?$/);
  });

  it("retries after a failed load", async () => {
    vi.mocked(getPerformers).mockRejectedValueOnce(new Error("Network down"));
    render(<CouplesScreen />);
    expect(await screen.findByText("Could not load your couples: Network down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: /Every couple/ })).toBeTruthy();
  });
});

describe("Week board", () => {
  beforeEach(() => {
    nav.search = new URLSearchParams("view=week");
    // Between episode 4 and 5, so the board opens on 4.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ranking = () => screen.getByRole("list", { name: "Couples" });

  it("ranks by the judges, then re-sorts by you with rank-change arrows", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(rowNames(ranking())).toEqual(["Jenna Dewan", "Tyler Cameron", "Amber Glenn"]);

    fireEvent.click(screen.getByRole("tab", { name: "You" }));
    expect(rowNames(ranking())).toEqual(["Amber Glenn", "Tyler Cameron", "Jenna Dewan"]);
    const first = within(ranking()).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("2 higher than the judges");
  });

  it("calls out the biggest disagreements and what's left to score", async () => {
    render(<CouplesScreen />);
    const callout = await screen.findByRole("region", { name: "Biggest disagreements" });
    expect(within(callout).getAllByRole("listitem")[0].textContent).toContain("You 1st");
    expect(within(callout).getAllByRole("listitem")[0].textContent).toContain("Judges 3rd");
    expect(screen.getByRole("heading", { name: "1 still to score" })).toBeTruthy();
  });

  it("links the panel to each judge's page", async () => {
    render(<CouplesScreen />);
    const derek = await screen.findByRole("link", { name: "Derek Hough" });
    expect(derek.getAttribute("href")).toMatch(/^\/people\/?\?id=derek-hough$/);
  });

  it("loads the episode picked", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(getWeekBoard).toHaveBeenCalledWith("dwts-35", 4, null);
  });

  it("asks nothing of a past season: no still-to-score card", async () => {
    vi.mocked(getWeekBoard).mockResolvedValue({ ...BOARD, open: true, answered: 0, locked: [] });
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(screen.queryByRole("heading", { name: /still to score/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Score them" })).toBeNull();
  });

  it("lists the couple sent home last and stamped, and the switch hides them", async () => {
    // Jenna topped the judges and still went home.
    vi.mocked(getWeekBoard).mockResolvedValue({ ...BOARD, eliminated: ["jenna-dewan"] });
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(rowNames(ranking())).toEqual(["Tyler Cameron", "Amber Glenn", "Jenna Dewan"]);
    const last = within(ranking()).getAllByRole("listitem")[2];
    expect(last.textContent).toContain("Eliminated · Week 3");

    const toggle = screen.getByRole("switch", { name: "Show eliminated" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(rowNames(ranking())).toEqual(["Tyler Cameron", "Amber Glenn"]);
    expect(window.localStorage.getItem("armchair.showEliminated.week-board")).toBe("0");
  });

  it("stamps nobody before the caller may know", async () => {
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    expect(screen.queryByText("Eliminated")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Show eliminated" })).toBeNull();
  });

  it("opens a couple's every dance from their row", async () => {
    vi.mocked(getWeekBoard).mockResolvedValue({ ...BOARD, eliminated: ["jenna-dewan"] });
    render(<CouplesScreen />);
    await screen.findByRole("list", { name: "Couples" });
    fireEvent.click(within(ranking()).getAllByRole("listitem")[2]);
    expect(nav.push).toHaveBeenCalledWith("/people/?id=jenna-dewan&season=dwts-35");
  });

  it("nudges to score an episode with nothing scored", async () => {
    vi.mocked(getWeekBoard).mockResolvedValue({ ...BOARD, couples: [], answered: 0, disagreements: [] });
    render(<CouplesScreen />);
    expect(await screen.findByText("Score this episode to see its board")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Score 4 dances" }).getAttribute("href")).toMatch(/^\/episode\/?\?ep=4$/);
  });
});
