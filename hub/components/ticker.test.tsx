import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { countdown, staticTickerItems } from "@/lib/ticker";

import { Ticker } from "./ticker";

const ITEMS = [
  { key: "a", label: "DWTS", text: "Live 8 to 10 PM ET" },
  { key: "b", label: "Survivor", text: "In rehearsal" },
];

describe("ticker", () => {
  it("gives screen readers each item once and hides the moving copies", () => {
    render(<Ticker label="What's on" items={ITEMS} />);
    const band = screen.getByRole("region", { name: "What's on" });
    expect(within(band).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "DWTS: Live 8 to 10 PM ET",
      "Survivor: In rehearsal",
    ]);
    const track = band.querySelector(".ticker-window");
    expect(track?.getAttribute("aria-hidden")).toBe("true");
    // Two identical halves, each long enough to overfill a wide screen.
    const halves = track?.querySelectorAll(".ticker-half") ?? [];
    expect(halves).toHaveLength(2);
    expect(halves[0].children.length).toBe(halves[1].children.length);
    expect(halves[0].children.length).toBeGreaterThanOrEqual(10);
  });

  it("has a pause toggle", () => {
    render(<Ticker label="What's on" items={ITEMS} />);
    const band = screen.getByRole("region", { name: "What's on" });
    const toggle = within(band).getByRole("button", { name: "Pause the ticker" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(band.hasAttribute("data-paused")).toBe(true);
  });

  it("renders nothing without items", () => {
    const { container } = render(<Ticker label="What's on" items={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("counts down in calendar days", () => {
    expect(countdown("2026-10-03", "2026-10-03")).toBe("tonight");
    expect(countdown("2026-10-04", "2026-10-03")).toBe("tomorrow");
    expect(countdown("2026-11-01", "2026-10-03")).toBe("in 29 days");
  });

  it("builds the signed-out band from the catalog, with no results in it", () => {
    const items = staticTickerItems({ seasons: 35, couples: 437, performances: 3425, judgeScores: 11219, firstYear: 2005, lastYear: 2026 });
    const text = items.map((i) => `${i.label}: ${i.text}`);
    expect(text).toContain("Archive: 35 DWTS seasons, 2005 to 2026");
    expect(text).toContain("Dances: 3,425 performances to score");
    expect(text.join(" ")).not.toMatch(/banish|murder|eliminat|winner/i);
  });
});
