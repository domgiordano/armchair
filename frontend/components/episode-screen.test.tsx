import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
  getEpisodeState: vi.fn(),
  submitScore: vi.fn(),
}));

import { getEpisodeState, getSeason, submitScore, type EpisodeState, type Season } from "@/lib/api/show";
import { EpisodeScreen } from "./episode-screen";

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

const value = (article: HTMLElement, label: string) =>
  within(article).getByText(label).nextElementSibling?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-10-01T12:00:00Z"));
  search = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getEpisodeState).mockResolvedValue(STATE);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("EpisodeScreen", () => {
  it("opens the latest aired episode and lists its cards", async () => {
    render(<EpisodeScreen />);
    expect(await screen.findByRole("heading", { name: "Yacht Rock" })).toBeTruthy();
    expect(getEpisodeState).toHaveBeenCalledWith("dwts-35", 4);
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

  it("disables scoring before the picked episode airs", async () => {
    search = new URLSearchParams("ep=5");
    vi.mocked(getEpisodeState).mockResolvedValue({ ...STATE, ep: 5, performances: [{ key: "amber-glenn#1", ...LOCKED }] });
    render(<EpisodeScreen />);
    const amber = await screen.findByRole("article", { name: "Amber Glenn & Pasha Pashkov" });
    expect(within(amber).getByText("Airs Tue, Oct 6")).toBeTruthy();
    expect(within(amber).getByRole("button", { name: /^Score 8 / })).toHaveProperty("disabled", true);
  });

  it("switches episodes through the URL", async () => {
    render(<EpisodeScreen />);
    fireEvent.change(await screen.findByRole("combobox", { name: "Episode" }), { target: { value: "5" } });
    expect(replace).toHaveBeenCalledWith("/episode/?ep=5");
  });
});
