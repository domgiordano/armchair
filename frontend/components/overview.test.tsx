import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/overview", () => ({ getOverview: vi.fn(), getLeaderboard: vi.fn() }));

import { ApiError } from "@armchair/app-core/api/client";
import { getLeaderboard, getOverview, type Leaderboard, type Overview as Data } from "@/lib/api/overview";
import { Overview } from "./overview";

const ME = "sub-me";
const judge = (id: string, name: string) => ({ id, name, headshot: null });

function episodes(aired: number, done: number[] = [], mae: Record<number, number> = {}) {
  return Array.from({ length: 12 }, (_, i) => {
    const ep = i + 1;
    const startsAt = new Date(Date.UTC(2026, 8, 16 + 7 * i)).toISOString();
    const base = {
      ep,
      week: ep,
      theme: ep === 6 ? "Super Bowl" : null,
      // 00:00Z is 8 PM Eastern the evening before.
      airDate: new Date(Date.parse(startsAt) - 86_400_000).toISOString().slice(0, 10),
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + 2 * 3600_000).toISOString(),
      aired: ep <= aired,
    };
    if (ep > aired) return base;
    return {
      ...base,
      rateable: 10,
      answered: done.includes(ep) ? 10 : 0,
      complete: done.includes(ep),
      scored: done.includes(ep) ? 10 : 0,
      mae: mae[ep] ?? null,
    };
  });
}

const couples = Array.from({ length: 16 }, (_, i) => ({
  id: `c${i}`,
  members: [
    { name: `Celeb ${i}`, role: "celebrity" as const, headshot: null },
    { name: `Pro ${i}`, role: "pro" as const, headshot: null },
  ],
  dances: 0,
  average: null,
  eliminated: null,
}));

function data(over: Partial<Data> = {}): Data {
  const eps = episodes(5);
  return {
    season: "dwts-35",
    open: false,
    timezone: "America/New_York",
    judges: [judge("carrie", "Carrie Ann Inaba"), judge("derek", "Derek Hough"), judge("bruno", "Bruno Tonioli")],
    progress: { aired: 5, total: 12, couples: 16, couplesLeft: 16 },
    me: { scored: 0, count: 0, mae: null, closestJudge: null, streak: 0 },
    next: { ep: 6, week: 6, theme: "Super Bowl", airDate: eps[5].airDate, startsAt: eps[5].startsAt },
    episodes: eps,
    reveals: [],
    couples,
    ...over,
  };
}

const board: Leaderboard = {
  minDances: 5,
  ranked: [
    { rank: 1, sub: "a", name: "Alex Top", picture: null, count: 20, mae: 0.8 },
    { rank: 2, sub: ME, name: "Me Myself", picture: null, count: 12, mae: 1.1 },
  ],
  me: { sub: ME, rank: 2 },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Two days after episode 5 aired.
  vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
  vi.mocked(getLeaderboard).mockResolvedValue(board);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Overview", () => {
  it("pulls a brand-new user into scoring, with empty states in place of numbers", async () => {
    vi.mocked(getOverview).mockResolvedValue(data());
    render(<Overview />);

    expect(await screen.findByRole("heading", { level: 1, name: "grab your paddle." })).toBeTruthy();
    const start = screen.getByRole("link", { name: "Catch up on 4 earlier episodes" });
    expect(start.getAttribute("href")).toMatch(/^\/episode\/?\?ep=1$/);
    expect(screen.queryByRole("button", { name: /Skip/ })).toBeNull();
    expect(screen.getByText("Your numbers start with your first paddle.")).toBeTruthy();
    expect(screen.getByText(/your gap to the judges draws here/)).toBeTruthy();
    expect(screen.getByText(/judges' paddles next to yours/)).toBeTruthy();
    expect(getOverview).toHaveBeenCalledWith("dwts-35");
  });

  it("counts down to the next episode and shows how far the season is", async () => {
    vi.mocked(getOverview).mockResolvedValue(data());
    render(<Overview />);

    const timer = await screen.findByRole("timer");
    // Episode 6 starts 2026-10-21T00:00Z, 4 days 12 hours away.
    expect(timer.getAttribute("aria-label")).toBe("Starts in 4 days, 12 hours, 0 minutes");
    expect(screen.getByText("Tue, Oct 20 · 8:00 PM ET")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Episodes aired" }).getAttribute("aria-valuenow")).toBe("5");
  });

  it("sends a returning user to the oldest unfinished episode", async () => {
    vi.mocked(getOverview).mockResolvedValue(
      data({ episodes: episodes(5, [1, 2, 3], { 1: 1.5, 2: 0.8 }), me: { scored: 30, count: 20, mae: 1.2, closestJudge: { id: "derek", name: "Derek Hough", mae: 0.9 }, streak: 3 } }),
    );
    render(<Overview />);

    expect(await screen.findByRole("heading", { level: 1, name: "catch up." })).toBeTruthy();
    expect(screen.getByText("2 episodes left to finish, starting with Week 4.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Catch up on 1 earlier episode" }).getAttribute("href")).toMatch(/\?ep=4$/);

    const tiles = within(screen.getByRole("region", { name: "Your season" }));
    expect(tiles.getByText("Dances scored").nextElementSibling?.textContent).toMatch(/^30across 3 episodes$/);
    expect(tiles.getByText("Derek")).toBeTruthy();
    expect(tiles.getByText("0.9 off on average")).toBeTruthy();

    const chart = within(screen.getByRole("table", { name: "Your average gap to the judges by episode" }));
    expect(chart.getAllByRole("row").map((r) => r.textContent)).toEqual([
      "EpisodeAverage gap",
      "Week 11.5 off",
      "Week 20.8 off",
      "Week 3not scored",
      "Week 4not scored",
      "Week 5not scored",
    ]);
  });

  it("leaves this week's show to its panel once nothing earlier is open", async () => {
    vi.mocked(getOverview).mockResolvedValue(data({ episodes: episodes(5, [1, 2, 3, 4]) }));
    render(<Overview />);
    expect(await screen.findByRole("heading", { level: 1, name: "grab your paddle." })).toBeTruthy();
    const show = screen.getByRole("region", { name: "This week's show" });
    expect(within(show).getByRole("link", { name: "Score this week's show" }).getAttribute("href")).toMatch(/\?ep=5$/);
    expect(screen.queryByRole("link", { name: "Start with Week 5" })).toBeNull();
  });

  it("offers a finished season to score from the start", async () => {
    vi.setSystemTime(new Date("2026-12-20T12:00:00Z"));
    vi.mocked(getOverview).mockResolvedValue(
      data({ episodes: episodes(12), next: null, progress: { aired: 12, total: 12, couples: 16, couplesLeft: 16 } }),
    );
    render(<Overview />);

    expect((await screen.findByRole("link", { name: "Score from the start" })).getAttribute("href")).toMatch(/\?ep=1$/);
    expect(screen.queryByRole("button", { name: "Just browse" })).toBeNull();
  });

  it("shows a past season as a wrap to browse, with no catch-up or paddle prompts", async () => {
    vi.setSystemTime(new Date("2026-12-20T12:00:00Z"));
    const all = episodes(12).map((e) => ({ ...e, answered: 0, complete: true }));
    vi.mocked(getOverview).mockResolvedValue(
      data({ open: true, episodes: all, next: null, progress: { aired: 12, total: 12, couples: 16, couplesLeft: 1 } }),
    );
    render(<Overview />);

    expect(await screen.findByRole("heading", { level: 1, name: "that's a wrap." })).toBeTruthy();
    expect(screen.getByText(/is over. Every score and result is open to browse./)).toBeTruthy();
    expect(screen.getByText("A past season, open to everyone.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Just browse" })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Score|^Catch up/ })).toBeNull();
  });

  it("points the live show's panel at the episode on air", async () => {
    vi.setSystemTime(new Date("2026-10-14T01:00:00Z"));
    vi.mocked(getOverview).mockResolvedValue(data({ episodes: episodes(4, [1, 2, 3, 4]), me: { scored: 40, count: 40, mae: 1, closestJudge: null, streak: 4 } }));
    render(<Overview />);

    expect(await screen.findByRole("heading", { level: 1, name: "you're on air." })).toBeTruthy();
    const show = screen.getByRole("region", { name: "This week's show" });
    expect(within(show).getByText("Live now")).toBeTruthy();
    expect(within(show).getByRole("link", { name: "Score this week's show" }).getAttribute("href")).toMatch(/\?ep=5$/);
  });

  it("shows a reveal as the judges' paddles beside yours", async () => {
    vi.mocked(getOverview).mockResolvedValue(
      data({
        me: { scored: 1, count: 1, mae: 1, closestJudge: null, streak: 0 },
        reveals: [
          {
            ep: 5,
            key: "c3#1",
            contestants: ["c3"],
            style: "Tango",
            song: "Hero",
            judges: [
              { id: "carrie", value: 7, state: "confirmed" },
              { id: "derek", value: 8, state: "confirmed" },
              { id: "bruno", value: 9, state: "confirmed" },
            ],
            mine: { value: 9 },
            panelMean: 8,
          },
        ],
      }),
    );
    render(<Overview />);

    const desk = await screen.findByRole("article", { name: "Celeb 3 & Pro 3" });
    expect(within(desk).getByText("Week 5 · Tango · Hero")).toBeTruthy();
    const paddles = within(within(desk).getByRole("list", { name: "Paddles" }));
    expect(paddles.getAllByRole("listitem").map((li) => li.querySelector(".sr-only")?.textContent)).toEqual([
      "Carrie Ann Inaba 7",
      "Derek Hough 8",
      "Bruno Tonioli 9",
      "You 9",
    ]);
    expect(desk.textContent).toContain("1 above the judges (8)");
  });

  it("lists the top of the leaderboard and marks the caller", async () => {
    vi.mocked(getOverview).mockResolvedValue(data());
    render(<Overview />);

    const top = within(await screen.findByRole("region", { name: "Leaderboard" }));
    const rows = await top.findAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual(["1ATAlex Top20 dances0.8off", "2MMMe Myself (you)12 dances1.1off"]);
  });

  it("keeps the overview up when the leaderboard fails, with its own retry", async () => {
    vi.mocked(getOverview).mockResolvedValue(data());
    vi.mocked(getLeaderboard).mockRejectedValueOnce(new ApiError(500, "Internal error"));
    render(<Overview />);

    const top = within(await screen.findByRole("region", { name: "Leaderboard" }));
    expect(await top.findByText("Could not load the leaderboard: Internal error")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    fireEvent.click(top.getByRole("button", { name: "Try again" }));
    expect(await top.findByText("Alex Top")).toBeTruthy();
  });

  it("shows six couples and expands to the whole cast", async () => {
    const ranked = couples.map((c, i) => ({
      ...c,
      average: i < 3 ? 9 - i : null,
      dances: i < 3 ? 2 : 0,
      eliminated: i === 15 ? { ep: 4, week: 3 } : null,
    }));
    vi.mocked(getOverview).mockResolvedValue(data({ couples: ranked }));
    render(<Overview />);

    const section = within(await screen.findByRole("region", { name: "Couples" }));
    expect(section.getAllByRole("listitem")).toHaveLength(6);
    expect(section.getAllByRole("listitem")[0].textContent).toContain("Celeb 0");
    fireEvent.click(section.getByRole("button", { name: "Show all 16 couples" }));
    const all = section.getAllByRole("listitem");
    expect(all).toHaveLength(16);
    expect(all[15].textContent).toContain("Eliminated · Week 3");
  });

  it("keeps eliminated couples at the end and hides them on request", async () => {
    // Celeb 0 has the best average and went home.
    const ranked = couples.map((c, i) => ({ ...c, average: 9 - i * 0.1, dances: 2, eliminated: i === 0 ? { ep: 2, week: 1 } : null }));
    vi.mocked(getOverview).mockResolvedValue(data({ couples: ranked }));
    render(<Overview />);

    const section = within(await screen.findByRole("region", { name: "Couples" }));
    fireEvent.click(section.getByRole("button", { name: "Show all 16 couples" }));
    expect(section.getAllByRole("listitem")[0].textContent).toContain("Celeb 1");
    expect(section.getAllByRole("listitem")[15].textContent).toContain("Eliminated · Week 1");

    fireEvent.click(section.getByRole("switch", { name: "Show eliminated" }));
    expect(section.getAllByRole("listitem")).toHaveLength(15);
    expect(section.queryByText("Eliminated")).toBeNull();
  });

  it("offers a retry when the overview fails", async () => {
    vi.mocked(getOverview).mockRejectedValueOnce(new ApiError(500, "Internal error")).mockResolvedValue(data());
    render(<Overview />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "grab your paddle." })).toBeTruthy();
  });
});
