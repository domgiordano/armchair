import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getVoting: vi.fn(),
}));

import { ApiError, getVoting, type Voting } from "@/lib/api/client";
import { VotePanel } from "./vote-panel";

const VOTING: Voting = {
  timezone: "America/New_York",
  episodes: [
    { ep: 5, airDate: "2026-10-06", start: "20:00", end: "22:00" },
    { ep: 6, airDate: "2026-10-13", start: "20:00", end: "22:00" },
  ],
  couples: [
    { cid: "amber-glenn", celebrity: "Amber Glenn", pro: "Pasha Pashkov", keyword: "Amber" },
    { cid: "connor-wood", celebrity: "Connor Wood", pro: "Rylee Arnold", keyword: "Connor W" },
  ],
};

// jsdom can't follow an sms: link and logs about it; the React handler still runs.
const stopNavigation = (e: MouseEvent) => e.preventDefault();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.mocked(getVoting).mockResolvedValue(VOTING);
  document.addEventListener("click", stopNavigation, true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
  document.removeEventListener("click", stopNavigation, true);
});

const row = (name: string) => screen.getByText(new RegExp(`^${name} and`)).closest("li") as HTMLElement;

describe("VotePanel", () => {
  it("offers an SMS link per couple while the live window is open, and tallies taps", async () => {
    vi.setSystemTime(new Date("2026-10-13T20:30:00-04:00"));
    render(<VotePanel />);

    const link = await screen.findByRole("link", { name: "Text Connor W to 21523" });
    expect(link.getAttribute("href")).toBe("sms:21523?body=Connor%20W");
    expect(screen.getByRole("link", { name: "dwtsvote.abc.com" }).getAttribute("href")).toBe(
      "https://dwtsvote.abc.com",
    );

    fireEvent.click(link);
    fireEvent.click(link);
    expect(within(row("Connor Wood")).getByText("2 of 10 sent")).toBeTruthy();
    expect(within(row("Amber Glenn")).getByText("0 of 10 sent")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("armchair:votes:6") ?? "")).toEqual({ "connor-wood": 2 });

    fireEvent.click(screen.getByRole("button", { name: "Undo one text for Connor Wood" }));
    expect(within(row("Connor Wood")).getByText("1 of 10 sent")).toBeTruthy();
  });

  it("stops offering the link at 10 texts", async () => {
    vi.setSystemTime(new Date("2026-10-13T20:30:00-04:00"));
    localStorage.setItem("armchair:votes:6", JSON.stringify({ "amber-glenn": 9 }));
    render(<VotePanel />);

    fireEvent.click(await screen.findByRole("link", { name: "Text Amber to 21523" }));
    expect(within(row("Amber Glenn")).getByText("10 of 10 sent")).toBeTruthy();
    expect(within(row("Amber Glenn")).getByText("Done")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Text Amber to 21523" })).toBeNull();
  });

  it("starts a new episode's tally at 0", async () => {
    vi.setSystemTime(new Date("2026-10-13T20:30:00-04:00"));
    localStorage.setItem("armchair:votes:5", JSON.stringify({ "amber-glenn": 10 }));
    render(<VotePanel />);

    await screen.findByRole("link", { name: "Text Amber to 21523" });
    expect(within(row("Amber Glenn")).getByText("0 of 10 sent")).toBeTruthy();
  });

  it("shows the closed state and the next live window outside it", async () => {
    vi.setSystemTime(new Date("2026-10-13T22:30:00-04:00"));
    vi.mocked(getVoting).mockResolvedValue({
      ...VOTING,
      episodes: [...VOTING.episodes, { ep: 7, airDate: "2026-10-20", start: "20:00", end: "22:00" }],
    });
    render(<VotePanel />);

    expect(await screen.findByText("Voting is closed.")).toBeTruthy();
    expect(screen.getByText(/The next one starts Tue, Oct 20 at 8:00 pm Eastern\./)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Text/ })).toBeNull();
  });

  it("says the season is over after the last episode", async () => {
    vi.setSystemTime(new Date("2026-10-14T12:00:00-04:00"));
    render(<VotePanel />);

    expect(await screen.findByText("Voting is over for this season.")).toBeTruthy();
  });

  it("offers a retry when the request fails", async () => {
    vi.setSystemTime(new Date("2026-10-13T20:30:00-04:00"));
    vi.mocked(getVoting).mockRejectedValueOnce(new ApiError(500, "Internal error"));
    render(<VotePanel />);

    expect(await screen.findByText("Could not load voting: Internal error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Text Amber to 21523" })).toBeTruthy();
  });
});
