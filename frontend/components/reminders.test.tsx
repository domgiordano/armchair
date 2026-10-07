import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api/overview", () => ({ getOverview: vi.fn() }));

import { getOverview, type Overview } from "@/lib/api/overview";
import { Reminders } from "./reminders";

const overview = (answered: number) =>
  ({
    open: false,
    timezone: "America/New_York",
    next: null,
    episodes: [
      {
        ep: 5,
        week: 4,
        theme: "Mariah Carey",
        airDate: "2026-10-06",
        startsAt: "2026-10-07T00:00:00Z",
        endsAt: "2026-10-07T02:00:00Z",
        aired: true,
        rateable: 12,
        answered,
        complete: answered === 12,
      },
    ],
  }) as unknown as Overview;

// The overview arrives through a mocked promise, but a loaded full-suite run can still take over a second.
const SLOW = { timeout: 5000 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // The morning after the show, Eastern.
  vi.setSystemTime(Date.parse("2026-10-07T14:00:00Z"));
  vi.mocked(getOverview).mockResolvedValue(overview(3));
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Reminders", () => {
  it("shows the banner and, once that day, the sheet", async () => {
    const { unmount } = render(<Reminders onScorecard={false} />);
    const banner = await screen.findByRole("region", { name: "Reminder" }, SLOW);
    expect(banner.textContent).toContain("Don't forget to score Week 4 · Mariah Carey · 9 left");
    expect(within(banner).getByRole("link", { name: "Score" }).getAttribute("href")).toMatch(/\?ep=5$/);
    const sheet = screen.getByRole("dialog", { name: "Reminder" });
    expect(sheet.textContent).toContain("Last night's show");
    expect(sheet.textContent).toContain("9 dances still need your paddle.");
    fireEvent.click(within(sheet).getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog", { name: "Reminder" })).toBeNull();

    unmount();
    render(<Reminders onScorecard={false} />);
    await screen.findByRole("region", { name: "Reminder" }, SLOW);
    expect(screen.queryByRole("dialog", { name: "Reminder" })).toBeNull();
  });

  it("remembers a dismissed banner for that episode", async () => {
    window.localStorage.setItem("armchair.reminder.shown", "2026-10-07");
    const { unmount } = render(<Reminders onScorecard={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss reminder" }, SLOW));
    expect(screen.queryByRole("region", { name: "Reminder" })).toBeNull();
    unmount();
    render(<Reminders onScorecard={false} />);
    await vi.waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2), SLOW);
    expect(screen.queryByRole("region", { name: "Reminder" })).toBeNull();
  });

  it("stays quiet two days after the show, once it's scored, and on the scorecard", async () => {
    vi.setSystemTime(Date.parse("2026-10-08T14:00:00Z"));
    const { unmount } = render(<Reminders onScorecard={false} />);
    await vi.waitFor(() => expect(getOverview).toHaveBeenCalled(), SLOW);
    expect(screen.queryByRole("region", { name: "Reminder" })).toBeNull();
    unmount();

    vi.setSystemTime(Date.parse("2026-10-07T14:00:00Z"));
    vi.mocked(getOverview).mockResolvedValue(overview(12));
    const done = render(<Reminders onScorecard={false} />);
    await vi.waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2), SLOW);
    expect(screen.queryByRole("region", { name: "Reminder" })).toBeNull();
    done.unmount();

    render(<Reminders onScorecard />);
    expect(getOverview).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still reminds when storage is refused", async () => {
    const refuse = () => {
      throw new Error("SecurityError");
    };
    // unstubAllGlobals would also drop vitest.setup's jsdom storage, so put that one back by hand.
    const storage = window.localStorage;
    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse, removeItem: refuse, clear: () => {} });
    render(<Reminders onScorecard={false} />);
    expect(await screen.findByRole("region", { name: "Reminder" }, SLOW)).toBeTruthy();
    vi.stubGlobal("localStorage", storage);
  });
});
