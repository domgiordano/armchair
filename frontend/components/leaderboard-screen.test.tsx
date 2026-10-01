import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => "/leaderboard/",
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/leaderboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/leaderboard")>()),
  getLeaderboard: vi.fn(),
}));
vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getMyGroups, type Group } from "@/lib/api/groups";
import { getLeaderboard, type Leaderboard, type Ranked } from "@/lib/api/leaderboard";
import { getSeason, type Season } from "@/lib/api/show";
import { judgeName, LeaderboardScreen } from "./leaderboard-screen";
import { choose } from "./ui/select-test-utils";

const SEASON: Season = {
  season: "dwts-35",
  timezone: "America/New_York",
  episodes: [],
  judges: [{ id: "derek-hough", name: "Derek Hough", headshot: null }],
  contestants: [],
};

const person = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const });
const row = (rank: number, sub: string, name: string, mae: number): Ranked => ({
  rank,
  ...person(sub, name),
  count: 10,
  mae,
  closestJudge: { id: "derek-hough", mae: mae - 0.2 },
});

const BOARD: Leaderboard = {
  season: "dwts-35",
  scope: "global",
  group: null,
  minDances: 5,
  ranked: [row(1, "a", "Ada", 0.8), row(2, "b", "Bo", 1.1), row(3, "c", "Cy", 1.25), row(4, "me", "Me Myself", 1.5)],
  unranked: [{ ...person("d", "Di"), count: 3 }],
  me: { ...row(4, "me", "Me Myself", 1.5) },
};

const FAMILY: Group = { id: "fam", name: "Family", inviteCode: "c".repeat(16), members: [] };

beforeEach(() => {
  search = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getLeaderboard).mockResolvedValue(BOARD);
  vi.mocked(getMyGroups).mockResolvedValue([]);
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LeaderboardScreen", () => {
  it("puts the top three on the podium, second-first-third, and the rest below", async () => {
    render(<LeaderboardScreen />);
    const podium = await screen.findByRole("list", { name: "Top three" });
    const steps = within(podium).getAllByRole("listitem").map((li) => li.textContent);
    expect(steps).toEqual(["BBo1.10 off2", "AAda0.80 off1", "CCy1.25 off3"]);
    const rest = screen.getByRole("list", { name: "Rankings" });
    expect(within(rest).getByText("Me Myself")).toBeTruthy();
    expect(within(rest).getByText("10 dances · closest to Derek Hough")).toBeTruthy();
    expect(getLeaderboard).toHaveBeenCalledWith("dwts-35", "global", null);
  });

  it("fetches once on Global, even after the caller's groups arrive", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([FAMILY]);
    render(<LeaderboardScreen />);
    await screen.findByRole("list", { name: "Top three" });
    await vi.waitFor(() => expect(getMyGroups).toHaveBeenCalled());
    expect(getLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("pins the caller's rank", async () => {
    render(<LeaderboardScreen />);
    const you = await screen.findByRole("complementary", { name: "Your standing" });
    expect(within(you).getByText("#4")).toBeTruthy();
    expect(within(you).getByText("1.50 off")).toBeTruthy();
    expect(screen.getByRole("listitem", { current: true })).toBeTruthy();
  });

  it("shows how far an unranked caller is from qualifying", async () => {
    vi.mocked(getLeaderboard).mockResolvedValue({
      ...BOARD,
      ranked: [],
      me: { ...person("me", "Me"), rank: null, count: 2, mae: 1, closestJudge: null },
    });
    render(<LeaderboardScreen />);
    expect(await screen.findByText(/Nobody has 5 scored dances yet/)).toBeTruthy();
    const you = screen.getByRole("complementary", { name: "Your standing" });
    expect(within(you).getByText("Unranked")).toBeTruthy();
    expect(within(you).getByText("2 of 5 dances to rank")).toBeTruthy();
    expect(screen.getByText("3/5")).toBeTruthy();
  });

  it("reads season and group from the URL", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([FAMILY]);
    search = new URLSearchParams({ season: "all", scope: "group", group: "fam" });
    render(<LeaderboardScreen />);
    await vi.waitFor(() => expect(getLeaderboard).toHaveBeenCalledWith("all", "group", "fam"));
    expect(screen.getByRole("tab", { name: "Groups" }).getAttribute("aria-selected")).toBe("true");
  });

  it("switching tab or season rewrites the URL", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([FAMILY]);
    render(<LeaderboardScreen />);
    fireEvent.click(await screen.findByRole("tab", { name: "Groups" }));
    expect(replace).toHaveBeenLastCalledWith("/leaderboard/?season=dwts-35&scope=group&group=fam");
    choose(screen.getByRole("combobox", { name: "Standings for" }), "All-time");
    expect(replace).toHaveBeenLastCalledWith("/leaderboard/?season=all&scope=global");
    fireEvent.click(screen.getByRole("tab", { name: "Friends" }));
    expect(replace).toHaveBeenLastCalledWith("/leaderboard/?season=dwts-35&scope=friends");
  });

  it("ranks friends from the Friends tab", async () => {
    search = new URLSearchParams({ scope: "friends" });
    render(<LeaderboardScreen />);
    await vi.waitFor(() => expect(getLeaderboard).toHaveBeenCalledWith("dwts-35", "friends", null));
  });

  it("points to groups when the caller has none", async () => {
    search = new URLSearchParams({ scope: "group" });
    render(<LeaderboardScreen />);
    expect(await screen.findByRole("link", { name: "Start or join one" })).toBeTruthy();
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it("retries after a failed load", async () => {
    vi.mocked(getLeaderboard).mockRejectedValueOnce(new Error("Network down"));
    render(<LeaderboardScreen />);
    expect(await screen.findByText("Could not load the leaderboard: Network down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("list", { name: "Top three" })).toBeTruthy();
  });
});

describe("judgeName", () => {
  it("falls back to the slugged id for a judge not in this season", () => {
    expect(judgeName("len-goodman", SEASON.judges)).toBe("Len Goodman");
    expect(judgeName("derek-hough", SEASON.judges)).toBe("Derek Hough");
  });
});
