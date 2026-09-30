import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/stats", () => ({ getStats: vi.fn() }));

import { getSeason, type Season } from "@/lib/api/show";
import { getStats, type Stats } from "@/lib/api/stats";
import { StatsScreen } from "./stats-screen";

const SEASON: Season = {
  season: "dwts-35",
  timezone: "America/New_York",
  episodes: [
    { ep: 3, week: 2, airDate: "2026-09-22", start: "20:00", end: "22:00", theme: null },
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: "Yacht Rock" },
  ],
  judges: [
    { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
    { id: "derek-hough", name: "Derek Hough", headshot: null },
  ],
  contestants: [],
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
    { ep: 3, key: "tyler-cameron#1", paddle: 6, panelMean: 8, error: 2 },
    { ep: 4, key: "amber-glenn#1", paddle: 7, panelMean: 8, error: 1 },
    { ep: 4, key: "tyler-cameron#1", paddle: 9, panelMean: 8, error: 1 },
  ],
  others: [
    { sub: "b", count: 3, mae: 0.8 },
    { sub: "c", count: 2, mae: 2 },
  ],
};

beforeEach(() => {
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getStats).mockResolvedValue(STATS);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StatsScreen", () => {
  it("shows the gap to the judges' average and the caller's rank", async () => {
    render(<StatsScreen />);
    expect(await screen.findByText("1.3 off")).toBeTruthy();
    expect(getStats).toHaveBeenCalledWith("dwts-35");
    expect(screen.getByText(/over 3 dances\. You rank 2 of 3/)).toBeTruthy();
  });

  it("names the closest judge and lists every judge by gap", async () => {
    render(<StatsScreen />);
    expect(await screen.findByRole("heading", { name: "Closest to Derek Hough" })).toBeTruthy();
    const terms = screen.getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["Derek Hough", "Carrie Ann Inaba"]);
  });

  it("lists each episode", async () => {
    render(<StatsScreen />);
    const list = (await screen.findByRole("heading", { name: "By episode" })).nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Week 21 dance · 2 off",
      "Week 32 dances · 1 off",
    ]);
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
