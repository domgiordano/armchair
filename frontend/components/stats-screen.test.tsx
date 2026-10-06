import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/stats", () => ({ getStats: vi.fn() }));
vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getMyGroups } from "@armchair/app-core/api/groups";
import { getSeason, type Season } from "@/lib/api/show";
import { getStats, type Stats } from "@/lib/api/stats";
import { StatsScreen } from "./stats-screen";
import { choose } from "./ui/select-test-utils";

const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [
    { ep: 3, week: 2, airDate: "2026-09-22", start: "20:00", end: "22:00", theme: null },
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: "Yacht Rock" },
  ],
  judges: [
    { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
    { id: "derek-hough", name: "Derek Hough", headshot: null },
  ],
  contestants: [
    {
      id: "tyler-cameron",
      keyword: "TYLER",
      members: [{ name: "Tyler Cameron", role: "celebrity", headshot: null }],
    },
  ],
};

const STATS: Stats = {
  season: "dwts-35",
  ep: null,
  mine: {
    count: 3,
    mae: 1.33,
    judges: {
      "carrie-ann-inaba": { count: 3, mae: 1.5 },
      "derek-hough": { count: 3, mae: 0.5 },
    },
  },
  episodes: [
    { ep: 3, count: 1, mae: 2, judges: {} },
    { ep: 4, count: 2, mae: 1, judges: {} },
  ],
  dances: [
    { ep: 3, key: "tyler-cameron#1", paddle: 6, panelMean: 8, error: 2, style: "Tango", judges: { "carrie-ann-inaba": 8, "derek-hough": 8 } },
    { ep: 4, key: "amber-glenn#1", paddle: 7, panelMean: 8, error: 1, style: "Jive", judges: { "carrie-ann-inaba": 9, "derek-hough": 7 } },
    { ep: 4, key: "tyler-cameron#1", paddle: 9, panelMean: 8, error: 1, style: "Tango", judges: { "carrie-ann-inaba": 8, "derek-hough": 8 } },
  ],
  others: [
    { sub: "b", count: 3, mae: 0.8 },
    { sub: "c", count: 2, mae: 2 },
  ],
  eliminated: {},
};

beforeEach(() => {
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getStats).mockResolvedValue(STATS);
  vi.mocked(getMyGroups).mockResolvedValue([]);
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StatsScreen", () => {
  it("shows the gap to the judges' average and the caller's rank", async () => {
    render(<StatsScreen />);
    expect(await screen.findByText("1.3 off")).toBeTruthy();
    expect(getStats).toHaveBeenCalledWith("dwts-35", null);
    expect(screen.getByText(/over 3 dances\. You rank 2 of 3/)).toBeTruthy();
  });

  it("reloads the stats for the group picked here or on the episode screen", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([{ id: "fam", name: "Family", inviteCode: "c".repeat(16), members: [] }]);
    window.localStorage.setItem("armchair.group", "fam");
    render(<StatsScreen />);
    const picker = await screen.findByRole("combobox", { name: "Compare with" });
    expect(getStats).toHaveBeenLastCalledWith("dwts-35", "fam");

    choose(picker, "Everyone");
    await vi.waitFor(() => expect(getStats).toHaveBeenLastCalledWith("dwts-35", null));
  });

  it("names the closest judge and bars every judge by gap", async () => {
    render(<StatsScreen />);
    expect(await screen.findByRole("heading", { name: "Closest to Derek Hough" })).toBeTruthy();
    const bars = within(screen.getByRole("list", { name: "By judge" })).getAllByRole("listitem");
    expect(bars.map((b) => b.textContent)).toEqual(["Derek Hough0.50 off · 3", "Carrie Ann Inaba1.50 off · 3"]);
  });

  it("bars each dance style, closest first", async () => {
    render(<StatsScreen />);
    const list = await screen.findByRole("list", { name: "By dance style" });
    expect(within(list).getAllByRole("listitem").map((b) => b.textContent)).toEqual([
      "Jive1.00 off · 1",
      "Tango1.50 off · 2",
    ]);
  });

  it("draws the season trend with one point per episode", async () => {
    render(<StatsScreen />);
    const chart = await screen.findByRole("img", { name: /Points off per episode: W2 2.00, W3 1.00/ });
    expect(chart.querySelectorAll("circle")).toHaveLength(2);
  });

  it("compares your paddles with the judges' scores", async () => {
    render(<StatsScreen />);
    expect(
      await screen.findByRole("img", { name: /at each value, you then judges: 6: 33% and 0%, 7: 33% and 17%/ }),
    ).toBeTruthy();
  });

  it("lists best calls and biggest misses with the couple's avatars and name", async () => {
    render(<StatsScreen />);
    const misses = await screen.findByRole("list", { name: "Biggest misses" });
    expect(within(misses).getAllByRole("listitem")[0].textContent).toBe("TCTyler CameronW2 · TangoYou 6 · judges 82 off");
    const best = screen.getByRole("list", { name: "Best calls" });
    expect(within(best).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("switch", { name: /Show eliminated/ })).toBeNull();
  });

  it("leaves eliminated couples out of the calls until switched on, then strikes and labels them", async () => {
    vi.mocked(getStats).mockResolvedValue({ ...STATS, eliminated: { "tyler-cameron": { ep: 4, week: 3 } } });
    render(<StatsScreen />);
    const best = await screen.findByRole("list", { name: "Best calls" });
    expect(within(best).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["amber-glennW3 · JiveYou 7 · judges 81 off"]);
    expect(screen.queryByRole("list", { name: "Biggest misses" })).toBeNull();

    const toggle = screen.getByRole("switch", { name: /Show eliminated/ });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);

    const miss = within(screen.getByRole("list", { name: "Biggest misses" })).getAllByRole("listitem")[0];
    expect(miss.textContent).toContain("Out week 3 · W2 · Tango");
    expect(within(miss).getByText("Tyler Cameron").closest(".line-through")).toBeTruthy();
    expect(window.localStorage.getItem("armchair.showEliminated.stats")).toBe("1");
  });

  it("plots one point per dance on both lines", async () => {
    render(<StatsScreen />);
    const chart = await screen.findByRole("img", { name: /across 3 dances/ });
    expect(chart.querySelectorAll("circle")).toHaveLength(3);
    const [judges, mine] = [...chart.querySelectorAll("polyline")].map((p) => p.getAttribute("points"));
    expect(judges?.split(" ")).toHaveLength(3);
    expect(mine?.split(" ")).toHaveLength(3);
    expect(chart.querySelector("title")?.textContent).toBe("Week 2: you 6, judges 8");
  });

  it("explains an empty set instead of showing zeros", async () => {
    vi.mocked(getStats).mockResolvedValue({
      ...STATS,
      mine: { count: 0, mae: null, judges: {} },
      episodes: [],
      dances: [],
      others: [],
    });
    render(<StatsScreen />);
    expect(await screen.findByText(/Nothing to compare yet/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("retries after a failed load", async () => {
    vi.mocked(getStats).mockRejectedValueOnce(new Error("Network down"));
    render(<StatsScreen />);
    expect(await screen.findByText("Could not load your stats: Network down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1.3 off")).toBeTruthy();
  });
});
