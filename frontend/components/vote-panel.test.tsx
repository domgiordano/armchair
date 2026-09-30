import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Contestant, Episode } from "@/lib/api/show";
import { VotePanel } from "./vote-panel";

const EPISODE: Episode = { ep: 6, week: 5, airDate: "2026-10-13", start: "20:00", end: "22:00", theme: null };
const couple = (id: string, keyword: string, celebrity: string, pro: string): Contestant => ({
  id,
  keyword,
  members: [
    { name: celebrity, role: "celebrity", headshot: null },
    { name: pro, role: "pro", headshot: null },
  ],
});
const COUPLES = [
  couple("amber-glenn", "Amber", "Amber Glenn", "Pasha Pashkov"),
  couple("connor-wood", "Connor W", "Connor Wood", "Rylee Arnold"),
];

const renderAt = (iso: string) =>
  render(<VotePanel episode={EPISODE} tz="America/New_York" couples={COUPLES} now={Date.parse(iso)} />);
const LIVE = "2026-10-13T20:30:00-04:00";

// jsdom can't follow an sms: link and logs about it; the React handler still runs.
const stopNavigation = (e: MouseEvent) => e.preventDefault();

beforeEach(() => {
  document.addEventListener("click", stopNavigation, true);
});

afterEach(() => {
  localStorage.clear();
  document.removeEventListener("click", stopNavigation, true);
});

const row = (name: string) => screen.getByText(new RegExp(`^${name} &`)).closest("li") as HTMLElement;

describe("VotePanel", () => {
  it("offers an SMS link per couple while voting is open, and tallies taps", () => {
    renderAt(LIVE);

    const link = screen.getByRole("link", { name: "Text Connor W to 21523" });
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

  it("stops offering the link at 10 texts", () => {
    localStorage.setItem("armchair:votes:6", JSON.stringify({ "amber-glenn": 9 }));
    renderAt(LIVE);

    fireEvent.click(screen.getByRole("link", { name: "Text Amber to 21523" }));
    expect(within(row("Amber Glenn")).getByText("10 of 10 sent")).toBeTruthy();
    expect(within(row("Amber Glenn")).getByText("Done")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Text Amber to 21523" })).toBeNull();
  });

  it("starts a new episode's tally at 0", () => {
    localStorage.setItem("armchair:votes:5", JSON.stringify({ "amber-glenn": 10 }));
    renderAt(LIVE);

    expect(within(row("Amber Glenn")).getByText("0 of 10 sent")).toBeTruthy();
  });

  it("says when voting opens earlier on the air date", () => {
    renderAt("2026-10-13T18:00:00-04:00");

    expect(screen.getByText(/Voting opens at 8:00 pm Eastern/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Text/ })).toBeNull();
  });

  it("is closed for a delayed or West Coast viewer after the live window", () => {
    renderAt("2026-10-13T20:30:00-07:00");

    expect(screen.getByText("Voting is closed.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Text/ })).toBeNull();
  });

  it("renders nothing on another day", () => {
    const { container } = renderAt("2026-10-14T20:30:00-04:00");
    expect(container.innerHTML).toBe("");
  });
});
