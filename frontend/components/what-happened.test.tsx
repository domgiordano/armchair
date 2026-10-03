import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WhatHappened } from "@/components/what-happened";
import type { Judge, Writeup } from "@/lib/api/show";

const judges: Judge[] = [
  {
    id: "derek-hough",
    name: "Derek Hough",
    headshot: { image: "derek-hough-5f221ba9e7.webp", author: "Kevin Paul", license: "CC BY 4.0", sourceUrl: "u" },
  },
];

const writeup: Writeup = {
  summary: "Amber and Pasha danced a smooth foxtrot.",
  judges: [
    { id: "derek-hough", text: "Called it exquisite.", quote: "the ice queen does it again" },
    { id: "bruno-tonioli", text: "Compared it to champagne.", quote: null },
  ],
  highlights: ["Icy elegance", "Clean frame"],
  sources: ["https://www.goldderby.com/reality-tv/2026/recap/", "https://people.com/recap-123"],
};

describe("WhatHappened", () => {
  it("renders nothing without a write-up", () => {
    const { container } = render(<WhatHappened writeup={null} judges={judges} />);
    expect(container.innerHTML).toBe("");
  });

  it("folds the write-up away behind a disclosure", () => {
    const { container } = render(<WhatHappened writeup={writeup} judges={judges} />);
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(screen.getByText("What happened").tagName).toBe("SUMMARY");
  });

  it("shows the summary, each judge by name and photo, chips, the AI label and sources", () => {
    const { container } = render(<WhatHappened writeup={writeup} judges={judges} />);
    expect(screen.getByText(writeup.summary!)).toBeTruthy();
    expect(screen.getByText("Derek Hough")).toBeTruthy();
    expect(screen.getByText(/the ice queen does it again/)).toBeTruthy();
    // A judge the season doesn't list keeps a name from the id and initials.
    expect(screen.getByText("Bruno Tonioli")).toBeTruthy();
    expect(screen.getByText("BT")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/derek-hough-5f221ba9e7\.webp$/);
    expect(screen.getByText("Icy elegance")).toBeTruthy();
    expect(screen.getByText(/Summary written by AI from published recaps/)).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["goldderby.com", "people.com"]);
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("says only that a locked one exists, and that scoring opens it", () => {
    const { container } = render(<WhatHappened writeup={{ locked: true }} judges={judges} />);
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).toMatch(/opens once you score this dance/);
  });
});
