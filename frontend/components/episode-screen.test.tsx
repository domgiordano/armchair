import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => "/episode/",
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  getMyGroups: vi.fn(),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
  getEpisodeState: vi.fn(),
  submitScore: vi.fn(),
  revealAll: vi.fn(),
  skipBefore: vi.fn(),
}));
vi.mock("@/lib/api/overview", () => ({ getOverview: vi.fn() }));

import { getMyGroups } from "@/lib/api/groups";
import { getOverview, type Overview, type OverviewEpisode } from "@/lib/api/overview";
import {
  getEpisodeState,
  getSeason,
  revealAll,
  skipBefore,
  submitScore,
  type EpisodeState,
  type Season,
} from "@/lib/api/show";
import { EpisodeScreen } from "./episode-screen";
import { choose } from "./ui/select-test-utils";

const person = (name: string) => ({ name, headshot: null });
const SEASON: Season = {
  season: "dwts-35",
  timezone: "America/New_York",
  episodes: [
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: "Yacht Rock" },
    { ep: 5, week: 4, airDate: "2026-10-06", start: "20:00", end: "22:00", theme: "Mariah Carey" },
  ],
  judges: [{ id: "carrie-ann-inaba", ...person("Carrie Ann Inaba") }, { id: "derek-hough", ...person("Derek Hough") }],
  contestants: [
    {
      id: "amber-glenn",
      keyword: "Amber",
      members: [
        { ...person("Amber Glenn"), role: "celebrity" },
        { ...person("Pasha Pashkov"), role: "pro" },
      ],
    },
    {
      id: "tyler-cameron",
      keyword: "Tyler",
      members: [
        { ...person("Tyler Cameron"), role: "celebrity" },
        { ...person("Sharna Burgess"), role: "pro" },
      ],
    },
  ],
};
const LOCKED = { contestants: ["amber-glenn"], n: 1, style: null, song: null, locked: true as const };
const STATE: EpisodeState = {
  season: "dwts-35",
  ep: 4,
  week: 3,
  airDate: "2026-09-29",
  theme: "Yacht Rock",
  panel: ["carrie-ann-inaba", "derek-hough"],
  rateable: 2,
  answered: 1,
  complete: false,
  performances: [
    { key: "amber-glenn#1", ...LOCKED },
    {
      key: "tyler-cameron#1",
      contestants: ["tyler-cameron"],
      n: 1,
      style: "Tango",
      song: "Example Song",
      locked: false,
      judges: [
        { id: "carrie-ann-inaba", value: 8, state: "confirmed" },
        { id: "derek-hough", value: 7.5, state: "provisional" },
      ],
      mine: { value: 6 },
      others: [{ sub: "b", value: 9 }],
      aggregate: { count: 2, mean: 7.5 },
    },
  ],
};

/** Per-episode state for getEpisodeState, each a patch over STATE. */
function episodes(byEp: Record<number, Partial<EpisodeState>>) {
  vi.mocked(getEpisodeState).mockImplementation(async (_, ep) => ({ ...STATE, ...byEp[ep] }));
}

/** getOverview with ep 4 and 5 aired; `answered` per ep out of 2, all answered by default. */
function overview(answered: Record<number, number>, next: Overview["next"] = null) {
  const episodes: OverviewEpisode[] = SEASON.episodes.map((e) => ({
    ...e,
    startsAt: `${e.airDate}T00:00:00Z`,
    endsAt: `${e.airDate}T02:00:00Z`,
    aired: true,
    rateable: 2,
    answered: answered[e.ep] ?? 2,
  }));
  vi.mocked(getOverview).mockResolvedValue({ episodes, next } as Overview);
}

const NEXT = { ep: 6, week: 5, theme: null, airDate: "2026-10-13", startsAt: "2026-10-14T00:00:00Z" };

const value = (article: HTMLElement, label: string) =>
  within(article).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-10-01T12:00:00Z"));
  search = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getEpisodeState).mockResolvedValue(STATE);
  vi.mocked(getMyGroups).mockResolvedValue([]);
  overview({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("EpisodeScreen", () => {
  it("lists only that night's couples in the vote panel while voting is open", async () => {
    vi.setSystemTime(Date.parse("2026-09-29T20:30:00-04:00"));
    const out = {
      id: "conner-leavitt",
      keyword: "Conner",
      members: [
        { ...person("Conner Leavitt"), role: "celebrity" as const },
        { ...person("Adele Zaikman"), role: "pro" as const },
      ],
    };
    vi.mocked(getSeason).mockResolvedValue({ ...SEASON, contestants: [...SEASON.contestants, out] });
    render(<EpisodeScreen />);

    const vote = await screen.findByRole("region", { name: "Vote" });
    expect(within(vote).getAllByRole("link", { name: /^Text/ }).map((a) => a.textContent)).toEqual([
      "Text Amber to 21523",
      "Text Tyler to 21523",
    ]);
  });

  it("opens the latest aired episode and lists its cards", async () => {
    render(<EpisodeScreen />);
    expect(await screen.findByRole("heading", { name: "Yacht Rock" })).toBeTruthy();
    expect(getEpisodeState).toHaveBeenCalledWith("dwts-35", 4, null);
    expect(screen.getByText("1 of 2 answered")).toBeTruthy();
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-labelledby"))).toEqual([
      "perf-amber-glenn#1",
      "perf-tyler-cameron#1",
    ]);
  });

  it("shows a revealed card as a plain number list", async () => {
    render(<EpisodeScreen />);
    const tyler = await screen.findByRole("article", { name: "Tyler Cameron & Sharna Burgess" });
    expect(within(tyler).getByText("Tango · \"Example Song\"")).toBeTruthy();
    expect(value(tyler, "Carrie Ann Inaba")).toBe("8");
    expect(value(tyler, "Derek Hough")).toBe("7.5unconfirmed");
    expect(value(tyler, "Judges' average")).toBe("7.8");
    expect(value(tyler, "You")).toBe("6");
    expect(value(tyler, "Everyone")).toBe("7.52 scores");
    expect(within(tyler).queryByRole("button")).toBeNull();
  });

  it("submits from a locked card and reloads the episode", async () => {
    vi.mocked(submitScore).mockResolvedValue({});
    render(<EpisodeScreen />);
    const amber = await screen.findByRole("article", { name: "Amber Glenn & Pasha Pashkov" });
    fireEvent.click(within(amber).getByRole("button", { name: /^Score 8 / }));
    fireEvent.click(within(amber).getByRole("button", { name: "Lock in 8" }));

    await vi.waitFor(() => expect(getEpisodeState).toHaveBeenCalledTimes(2));
    expect(submitScore).toHaveBeenCalledWith("dwts-35", 4, STATE.performances[0], { value: 8 });
  });

  it("lets a locked team dance be scored like any couple", async () => {
    vi.mocked(submitScore).mockResolvedValue({});
    const team = { ...LOCKED, key: "amber-glenn+tyler-cameron#1", contestants: ["amber-glenn", "tyler-cameron"] };
    episodes({ 4: { performances: [team] } });
    render(<EpisodeScreen />);

    const card = await screen.findByRole("article", { name: "Amber Glenn, Tyler Cameron" });
    fireEvent.click(within(card).getByRole("button", { name: /^Score 7 / }));
    fireEvent.click(within(card).getByRole("button", { name: "Lock in 7" }));
    await vi.waitFor(() => expect(submitScore).toHaveBeenCalledWith("dwts-35", 4, team, { value: 7 }));
  });

  it("opens a past season's last episode, whose fixture has no times", async () => {
    const untimed = SEASON.episodes.map((e) => ({ ...e, airDate: null, start: null, end: null }));
    vi.mocked(getSeason).mockResolvedValue({ ...SEASON, season: "dwts-20", episodes: untimed });
    episodes({ 4: { answered: 2 }, 5: { ep: 5, theme: "Mariah Carey" } });
    render(<EpisodeScreen />);

    expect(await screen.findByRole("heading", { name: "Mariah Carey" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Vote" })).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "Episode" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Week 3 · Yacht Rock", "Week 4 · Mariah Carey"]);
  });

  it("disables scoring before the picked episode airs", async () => {
    search = new URLSearchParams("ep=5");
    episodes({ 4: { answered: 2 }, 5: { ep: 5, answered: 0, performances: [{ key: "amber-glenn#1", ...LOCKED }] } });
    render(<EpisodeScreen />);
    const amber = await screen.findByRole("article", { name: "Amber Glenn & Pasha Pashkov" });
    expect(within(amber).getByText("Airs Tue, Oct 6")).toBeTruthy();
    expect(within(amber).getByRole("button", { name: /^Score 8 / })).toHaveProperty("disabled", true);
  });

  it("switches episodes through the URL", async () => {
    render(<EpisodeScreen />);
    choose(await screen.findByRole("combobox", { name: "Episode" }), /Mariah Carey/);
    expect(replace).toHaveBeenCalledWith("/episode/?ep=5");
  });

  it("offers Reveal all for what is left and reloads after it", async () => {
    vi.mocked(revealAll).mockResolvedValue({ revealed: ["amber-glenn#1"] });
    render(<EpisodeScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Reveal all" }));

    expect(screen.getByText("Reveal the 1 dance you haven't scored?")).toBeTruthy();
    expect(revealAll).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("group", { name: "Reveal all" })).getByRole("button", { name: "Reveal all" }));

    expect(revealAll).toHaveBeenCalledWith("dwts-35", 4);
    await vi.waitFor(() => expect(getEpisodeState).toHaveBeenCalledTimes(2));
  });

  it("reloads the episode for the picked group", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([{ id: "fam", name: "Family", inviteCode: "c".repeat(16), members: [] }]);
    render(<EpisodeScreen />);
    choose(await screen.findByRole("combobox", { name: "Compare with" }), "Family (0)");
    await vi.waitFor(() => expect(getEpisodeState).toHaveBeenLastCalledWith("dwts-35", 4, "fam"));
  });

  it("seats the picked group's members who scored, and everyone's average without a group", async () => {
    const member = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const });
    vi.mocked(getMyGroups).mockResolvedValue([
      {
        id: "fam",
        name: "Family",
        inviteCode: "c".repeat(16),
        members: [member("me", "Pat Viewer"), member("c", "Lee Friend"), member("b", "Sam Friend")],
      },
    ]);
    window.localStorage.clear();
    const { container } = render(<EpisodeScreen />);
    const seats = () => [...container.querySelectorAll<HTMLElement>("[data-seat]")];

    await screen.findByRole("heading", { name: "Yacht Rock" });
    expect(seats().map((s) => s.dataset.seat)).toEqual(["judge", "judge", "you", "crowd"]);

    choose(screen.getByRole("combobox", { name: "Compare with" }), "Family (3)");
    await vi.waitFor(() => expect(seats().map((s) => s.dataset.seat)).toEqual(["judge", "judge", "you", "member"]));
    const sam = seats()[3];
    expect(within(sam).getByText("Sam")).toBeTruthy();
    expect(sam.querySelector("[data-paddle]")?.textContent).toBe("9");
  });

  it("hides Reveal all once everything is answered", async () => {
    episodes({ 4: { answered: 2 } });
    render(<EpisodeScreen />);
    await screen.findByRole("heading", { name: "Yacht Rock" });
    expect(screen.queryByRole("button", { name: "Reveal all" })).toBeNull();
  });
});

describe("catching up", () => {
  beforeEach(() => {
    vi.setSystemTime(Date.parse("2026-10-07T12:00:00Z"));
    episodes({ 5: { ep: 5, theme: "Mariah Carey" } });
  });

  it("offers catch up week by week or skip while week 3 is unfinished", async () => {
    overview({ 4: 1 }, NEXT);
    render(<EpisodeScreen />);

    expect(await screen.findByRole("heading", { name: "You're 1 earlier episode behind" })).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(getOverview).toHaveBeenCalledExactlyOnceWith("dwts-35");

    fireEvent.click(screen.getByRole("button", { name: "Catch up on 1 earlier episode" }));
    expect(replace).toHaveBeenCalledWith("/episode/?ep=4");
    expect(skipBefore).not.toHaveBeenCalled();
  });

  it("skips to week 4 only after the confirm, then opens it", async () => {
    overview({ 4: 1 }, NEXT);
    vi.mocked(skipBefore).mockResolvedValue({ revealed: [{ ep: 4, keys: ["amber-glenn#1"] }] });
    render(<EpisodeScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Skip to week 4" }));
    const confirm = screen.getByRole("group", { name: "Skip 1 earlier episode?" });
    expect(within(confirm).getByText(/won.t count toward your accuracy/)).toBeTruthy();
    expect(skipBefore).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Skip to week 4" }));
    expect(await screen.findByRole("heading", { name: "Mariah Carey" })).toBeTruthy();
    expect(skipBefore).toHaveBeenCalledExactlyOnceWith("dwts-35", 5);
  });

  it("stays on the question and says so when the skip fails", async () => {
    overview({ 4: 1 }, NEXT);
    vi.mocked(skipBefore).mockRejectedValue(new Error("Internal error"));
    render(<EpisodeScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Skip to week 4" }));
    fireEvent.click(within(screen.getByRole("group")).getByRole("button", { name: "Skip to week 4" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Nothing skipped: Internal error");
    expect(screen.queryByRole("heading", { name: "Mariah Carey" })).toBeNull();
  });

  it("can still open week 4 and leave week 3 scorable", async () => {
    overview({ 4: 1 }, NEXT);
    render(<EpisodeScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Open week 4 and leave week 3 for later" }));

    expect(await screen.findByRole("heading", { name: "Mariah Carey" })).toBeTruthy();
    expect(getEpisodeState).toHaveBeenLastCalledWith("dwts-35", 5, null);
    expect(skipBefore).not.toHaveBeenCalled();
  });

  it("offers browse or score from the start once the season is over", async () => {
    overview({ 4: 0, 5: 0 });
    vi.mocked(skipBefore).mockResolvedValue({ revealed: [] });
    render(<EpisodeScreen />);

    expect(await screen.findByRole("heading", { name: "Browse or score this season?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Score from the start" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Just browse" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse the season" }));

    expect(await screen.findByRole("heading", { name: "Mariah Carey" })).toBeTruthy();
    expect(skipBefore).toHaveBeenCalledExactlyOnceWith("dwts-35", 6);
  });

  it("skips the question when week 3 is finished", async () => {
    render(<EpisodeScreen />);
    expect(await screen.findByRole("heading", { name: "Mariah Carey" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /behind$|season\?$/ })).toBeNull();
  });
});
