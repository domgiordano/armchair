import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let search = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/stats/",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/stats", () => ({ getPersonStats: vi.fn(), getCrowdStats: vi.fn() }));
vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getMyGroups } from "@armchair/app-core/api/groups";
import { getSeason } from "@/lib/api/show";
import { getCrowdStats, getPersonStats } from "@/lib/api/stats";
import { CROWD, PERSON, SEASON } from "./test-fixtures";
import { StatsScreen } from "./stats-screen";

beforeEach(() => {
  search = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getPersonStats).mockResolvedValue(PERSON);
  vi.mocked(getMyGroups).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StatsScreen, Me", () => {
  it("leads with the average gap and the numbers under it", async () => {
    render(<StatsScreen />);
    const hero = await screen.findByRole("region", { name: "Against the judges' average" });
    expect(hero.textContent).toContain("over 4 dances");
    expect(hero.textContent).toContain("#2 of 5");
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("Over by 0.25")).toBeTruthy();
    expect(getPersonStats).toHaveBeenCalledWith("dwts-35", null, null);
  });

  it("charts the season by week and lists every week", async () => {
    render(<StatsScreen />);
    expect(await screen.findByRole("img", { name: /^Gap by week: W3 1.00, W4 1.50/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Place by week/ })).toBeTruthy();
    const weeks = screen.getByRole("list", { name: "Week by week" });
    expect(within(weeks).getAllByRole("listitem")).toHaveLength(2);
  });

  it("names favorites and least favorites, and links calls to their episode", async () => {
    render(<StatsScreen />);
    const favorites = await screen.findByRole("list", { name: "Favorites" });
    expect(favorites.textContent).toContain("Tyler Cameron");
    expect(favorites.textContent).toContain("+1.50");
    expect(screen.getByRole("list", { name: "Least favorites" }).textContent).toContain("Jenna Dewan");
    const best = screen.getByRole("list", { name: "Best calls" });
    expect(within(best).getAllByRole("link", { name: "Week 3" })[0].getAttribute("href")).toContain("ep=4");
  });

  it("narrows to one week from the query string and hides the season charts", async () => {
    search = new URLSearchParams("ep=5");
    vi.mocked(getPersonStats).mockResolvedValue({ ...PERSON, ep: 5, weeks: PERSON.weeks.slice(1) });
    render(<StatsScreen />);
    await screen.findByRole("region", { name: "Against the judges' average" });
    expect(getPersonStats).toHaveBeenCalledWith("dwts-35", null, 5);
    expect(screen.queryByRole("img", { name: /^Gap by week/ })).toBeNull();
  });

  it("shows a friend's stats from ?sub= under their name", async () => {
    search = new URLSearchParams("sub=b");
    vi.mocked(getPersonStats).mockResolvedValue({ ...PERSON, sub: "b", person: { sub: "b", name: "Bea Arthur" } });
    render(<StatsScreen />);
    await screen.findByRole("region", { name: "Against the judges' average" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bea Arthur's stats");
    expect(getPersonStats).toHaveBeenCalledWith("dwts-35", "b", null);
    expect(screen.getByRole("link", { name: "Your stats" }).getAttribute("href")).toMatch(/^\/stats\/?$/);
  });

  it("explains an empty season", async () => {
    vi.mocked(getPersonStats).mockResolvedValue({ ...PERSON, count: 0, mae: null, weeks: [], calls: [] });
    render(<StatsScreen />);
    expect(await screen.findByText("Nothing to compare yet")).toBeTruthy();
  });

  it("offers a retry when the read fails", async () => {
    vi.mocked(getPersonStats).mockRejectedValue(new Error("Network down"));
    render(<StatsScreen />);
    expect((await screen.findByRole("alert")).textContent).toContain("Network down");
  });
});

describe("StatsScreen, Groups and Global", () => {
  const GROUP = { id: "g1", name: "Family", members: [], shows: ["dwts"] };

  beforeEach(() => {
    vi.mocked(getCrowdStats).mockResolvedValue(CROWD);
  });

  it("shows leaders by week, newest first, with the season leader after each", async () => {
    search = new URLSearchParams("view=global");
    vi.mocked(getCrowdStats).mockResolvedValue({ ...CROWD, scope: "global", group: null, members: undefined, headToHead: undefined, global: undefined });
    render(<StatsScreen />);
    const weeks = await screen.findByRole("list", { name: "Leaders by week" });
    const items = within(weeks).getAllByRole("listitem").filter((li) => li.parentElement === weeks);
    expect(items[0].textContent).toContain("Week 4");
    expect(items[0].textContent).toMatch(/1\.\s*Cy Twombly/);
    expect(items[0].textContent).toContain("Season leader after it: Bea Arthur");
    expect(getCrowdStats).toHaveBeenCalledWith("dwts-35", "global", null, null);
    expect(screen.queryByRole("region", { name: "Members" })).toBeNull();
  });

  it("charts couple votes as a heatmap with every week's crowd and judges", async () => {
    search = new URLSearchParams("view=global");
    render(<StatsScreen />);
    const table = await screen.findByRole("table", { name: /Crowd average minus the judges' average/ });
    expect(table.textContent).toContain("Tyler Cameron, Week 3: crowd 9, judges 8 (+1.00), 3 raters");
    expect(screen.getByRole("list", { name: "Most divisive dances" }).textContent).toContain("spread 2.16");
  });

  it("compares a group: member cards, head to head and the group against everyone", async () => {
    search = new URLSearchParams("view=groups");
    vi.mocked(getMyGroups).mockResolvedValue([GROUP] as never);
    render(<StatsScreen />);
    const members = await screen.findByRole("list", { name: "Members" });
    expect(within(members).getAllByRole("listitem").filter((li) => li.parentElement === members)).toHaveLength(3);
    expect(screen.getByRole("list", { name: "Head to head" }).textContent).toContain("vs Bea Arthur1-1");
    expect(screen.getByRole("img", { name: "Family and everyone's average gap by week" })).toBeTruthy();
    expect(getCrowdStats).toHaveBeenCalledWith("dwts-35", "group", "g1", null);
  });

  it("points to starting a group when there are none", async () => {
    search = new URLSearchParams("view=groups");
    render(<StatsScreen />);
    expect(await screen.findByText("No groups yet")).toBeTruthy();
    expect(getCrowdStats).not.toHaveBeenCalled();
  });
});
