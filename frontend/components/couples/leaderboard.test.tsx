import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/couples/",
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/overview", () => ({ getOverview: vi.fn() }));
vi.mock("@armchair/app-core/favorites/odds", async (actual) => ({
  ...(await actual<typeof import("@armchair/app-core/favorites/odds")>()),
  getOdds: vi.fn(),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getEpisodeState: vi.fn(),
}));

import { getOverview, type Overview, type OverviewEpisode } from "@/lib/api/overview";
import { getOdds, type OddsBoard } from "@armchair/app-core/favorites/odds";
import { getEpisodeState, type Card, type EpisodeState, type Season } from "@/lib/api/show";
import { choose } from "@/components/ui/select-test-utils";
import { LeaderboardView } from "./leaderboard";

const pair = (id: string, celebrity: string, pro: string) => ({
  id,
  keyword: id,
  members: [
    { name: celebrity, role: "celebrity" as const, headshot: null },
    { name: pro, role: "pro" as const, headshot: null },
  ],
});
const SEASON = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [],
  judges: [],
  contestants: [
    pair("ezra-frech", "Ezra Frech", "Daniella Karagach"),
    pair("amber-glenn", "Amber Glenn", "Pasha Pashkov"),
    pair("taylor-hanson", "Taylor Hanson", "Britt Stewart"),
  ],
} as Season;

const card = (couple: string, marks: number[], style = "Tango"): Card => ({
  key: `${couple}#1`,
  contestants: [couple],
  n: 1,
  style,
  song: null,
  locked: false,
  judges: marks.map((value, i) => ({ id: `j${i}`, value, state: "confirmed" })),
  mine: { value: 7 },
  others: [
    { sub: "a", value: 8 },
    { sub: "b", value: 8 },
  ],
  aggregate: { count: 3, mean: 7.67 },
});

// Week 1: Amber 8, Ezra 7, Taylor 6. Week 2: Ezra 10 (a perfect Jive), Amber 6, Taylor 7, who goes home that night.
const STATES: Record<number, EpisodeState> = {
  1: { season: "dwts-35", ep: 1, week: 1, airDate: null, theme: "Premiere", panel: [], open: false, rateable: 3, answered: 3, complete: true, performances: [card("amber-glenn", [8, 8, 8]), card("ezra-frech", [7, 7, 7]), card("taylor-hanson", [6, 6, 6])], eliminated: [] },
  2: { season: "dwts-35", ep: 2, week: 2, airDate: null, theme: "Viral Hits", panel: [], open: false, rateable: 3, answered: 3, complete: true, performances: [card("amber-glenn", [6, 6, 6]), card("ezra-frech", [10, 10, 10], "Jive"), card("taylor-hanson", [7, 7, 7])], eliminated: ["taylor-hanson"] },
};

const episode = (ep: number, complete: boolean): OverviewEpisode =>
  ({ ep, week: ep, theme: STATES[ep]?.theme ?? null, airDate: null, startsAt: null, endsAt: null, aired: true, complete }) as OverviewEpisode;

function serve(done: number) {
  vi.mocked(getOverview).mockResolvedValue({ season: "dwts-35", episodes: [episode(1, done >= 1), episode(2, done >= 2)] } as Overview);
  vi.mocked(getEpisodeState).mockImplementation(async (_s, ep) => STATES[ep]);
}

function screenWidth(wide: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: wide && q.includes("min-width"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
}

const rowNames = (container: HTMLElement) =>
  within(container)
    .getAllByRole("link", { name: /& / })
    .map((a) => a.textContent?.split(" & ")[0]);

const odds = (asOf: number, entries: [string, string, number, number][]) =>
  ({
    asOf,
    entries: entries.map(([id, line, chance, rank], i) => ({ id, rank: i + 1, odds: line, chance, move: { rank, chance: 0 } })),
  }) as unknown as OddsBoard<null>;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getOdds).mockImplementation(async (_s, through) =>
    through === 1
      ? odds(1, [["ezra-frech", "+150", 0.4, 0], ["amber-glenn", "+200", 0.33, 0], ["taylor-hanson", "+400", 0.2, 0]])
      : odds(2, [["ezra-frech", "-150", 0.6, 0], ["amber-glenn", "+150", 0.4, 0]]),
  );
});
afterEach(() => vi.clearAllMocks());

describe("Couples leaderboard on a desktop", () => {
  beforeEach(() => screenWidth(true));

  it("ranks the couples still dancing by the judges' average, with movement since last week", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    const table = await screen.findByRole("table", { name: /judges' average, as of week 2/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^11 place up since week 1.*Ezra Frech.*8\.510\.0Jive/),
      expect.stringMatching(/^21 place down since week 1.*Amber Glenn.*7\.0/),
      expect.stringMatching(/^–.*Taylor Hanson.*Eliminated · Week 2$/),
    ]);
    expect(within(table).getByRole("columnheader", { name: "Avg" }).getAttribute("aria-sort")).toEqual("descending");
  });

  it("re-sorts from a column header", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    const table = await screen.findByRole("table");
    fireEvent.click(within(table).getByRole("button", { name: "Perfect" }));
    expect(within(table).getByRole("columnheader", { name: "Perfect" }).getAttribute("aria-sort")).toEqual("descending");
    expect(screen.getByRole("table", { name: /perfect scores/ })).toBeTruthy();
  });

  it("opens a couple's page from their row", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    const table = await screen.findByRole("table");
    fireEvent.click(within(table).getAllByRole("row")[2]);
    expect(nav.push).toHaveBeenCalledWith("/couples/couple/?id=amber-glenn&season=dwts-35");
  });

  it("heads the board with the podium, the movers and the best dance so far", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    const strip = await screen.findByRole("region", { name: "Week 2 highlights" });
    expect(within(strip).getByText("Biggest climber").closest("div")?.textContent).toMatch(/Ezra Frech/);
    expect(within(strip).getByText("Highest score").closest("div")?.textContent).toMatch("Jive, week 2, perfect");
  });
});

describe("Couples leaderboard on a phone", () => {
  beforeEach(() => screenWidth(false));

  it("lists ranked rows and re-sorts from the Rank by menu", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    const list = await screen.findByRole("list", { name: /judges' average/ });
    expect(rowNames(list)).toEqual(["Ezra Frech", "Amber Glenn", "Taylor Hanson"]);
    choose(screen.getByRole("combobox", { name: "Rank by" }), "Best score");
    expect(rowNames(screen.getByRole("list", { name: /best score/ }))).toEqual(["Ezra Frech", "Amber Glenn", "Taylor Hanson"]);
  });

  it("goes back a week, when the eliminated couple was still dancing", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    await screen.findByRole("list", { name: /as of week/ });
    choose(screen.getByRole("combobox", { name: "Board as of" }), /Week 1/);
    expect(rowNames(screen.getByRole("list", { name: /as of week 1/ }))).toEqual(["Amber Glenn", "Ezra Frech", "Taylor Hanson"]);
    expect(screen.queryByText(/Out week/)).toBeNull();
  });

  it("hides the eliminated with the switch", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    await screen.findByRole("list", { name: /as of week/ });
    fireEvent.click(screen.getByRole("switch", { name: "Show eliminated" }));
    expect(rowNames(screen.getByRole("list", { name: /judges' average/ }))).toEqual(["Ezra Frech", "Amber Glenn"]);
  });
});

describe("Couples leaderboard spoilers", () => {
  beforeEach(() => screenWidth(false));

  it("holds the board at the last week finished: no later scores, and the couple sent home later still dancing", async () => {
    serve(1);
    render(<LeaderboardView season={SEASON} />);
    const list = await screen.findByRole("list", { name: /as of week 1/ });
    expect(getEpisodeState).toHaveBeenCalledTimes(1);
    expect(rowNames(list)).toEqual(["Amber Glenn", "Ezra Frech", "Taylor Hanson"]);
    expect(screen.queryByText(/Out week/)).toBeNull();
    expect(screen.queryByText("10.0")).toBeNull();
    expect(screen.getByRole("status")?.textContent).toMatch("Finish week 2 to move the board on.");
    expect(screen.getByRole("link", { name: "Score it" }).getAttribute("href")).toMatch(/\/episode\/?\?ep=2/);
  });

  it("opens nothing before week one is finished", async () => {
    serve(0);
    render(<LeaderboardView season={SEASON} />);
    expect(await screen.findByText("Finish week 1 to open the board")).toBeTruthy();
    expect(getEpisodeState).not.toHaveBeenCalled();
    expect(screen.queryByText("Ezra Frech")).toBeNull();
  });
});

describe("Comparing couples", () => {
  beforeEach(() => screenWidth(true));

  it("picks couples from their rows, without opening their page, and compares them side by side", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Ezra Frech" }));
    const bar = screen.getByRole("region", { name: "Compare couples" });
    expect(within(bar).getByText("Pick one more to compare")).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Compare 1" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Taylor Hanson" }));
    expect(nav.push).not.toHaveBeenCalled();
    fireEvent.click(within(bar).getByRole("button", { name: "Compare 2" }));

    const sheet = screen.getByRole("dialog", { name: "Compare couples" });
    const table = within(sheet).getByRole("table", { name: "Ezra Frech, Taylor Hanson compared" });
    const avg = within(table).getByRole("rowheader", { name: "Judges' avg" }).closest("tr");
    expect(avg?.textContent).toBe("Judges' avg8.56.5");
    expect(within(avg as HTMLElement).getByText("8.5").className).toContain("text-gold-light");
    expect(within(sheet).getByRole("img").getAttribute("aria-label")).toBe("Ezra Frech: week 1 7.0, week 2 10.0; Taylor Hanson: week 1 6.0, week 2 7.0");
  });

  it("stops at three", async () => {
    serve(2);
    const four = { ...SEASON, contestants: [...SEASON.contestants, pair("jenna-dewan", "Jenna Dewan", "Val Chmerkovskiy")] };
    render(<LeaderboardView season={four} />);
    await screen.findByRole("table");
    for (const name of ["Ezra Frech", "Amber Glenn", "Taylor Hanson"]) fireEvent.click(screen.getByRole("checkbox", { name: `Compare ${name}` }));
    expect((screen.getByRole("checkbox", { name: "Compare Jenna Dewan" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Compare 3" }).hasAttribute("disabled")).toBe(false);
  });

  it("clears the picks", async () => {
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Amber Glenn" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Compare couples" })).toBeNull();
    expect((screen.getByRole("checkbox", { name: "Compare Amber Glenn" }) as HTMLInputElement).checked).toBe(false);
  });
});

describe("Couples leaderboard odds", () => {
  it("shows each couple's odds and ranks by them, the board's week setting the snapshot", async () => {
    screenWidth(true);
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    const table = await screen.findByRole("table");
    await within(table).findByText("-150");
    expect(getOdds).toHaveBeenLastCalledWith("dwts-35", 2);
    fireEvent.click(within(table).getByRole("button", { name: "Odds" }));
    const rows = within(screen.getByRole("table", { name: /odds to win/ })).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toMatch(/Ezra Frech.*-15060%/);
    expect(rows[1].textContent).toMatch(/Amber Glenn.*\+15040%/);
  });

  it("goes back to the odds from before an elimination when the board goes back a week", async () => {
    screenWidth(false);
    serve(2);
    render(<LeaderboardView season={SEASON} />);
    await screen.findByText("-150");
    choose(screen.getByRole("combobox", { name: "Board as of" }), /Week 1/);
    expect(await screen.findByText("+400")).toBeTruthy();
    expect(getOdds).toHaveBeenLastCalledWith("dwts-35", 1);
  });
});
