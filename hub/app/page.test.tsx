import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";

vi.mock("next/font/google", () => {
  const font = () => ({ className: "font" });
  return { Cinzel: font, Permanent_Marker: font, Playfair_Display: font };
});

// jsdom has no IntersectionObserver; the section rail only needs it to exist.
class NoopObserver {
  observe() {}
  disconnect() {}
}

describe("landing", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", NoopObserver);
    sessionStorage.setItem("armchair-hub:intro-seen", "1");
  });

  it("sends the primary CTA to the Dancing with the Stars app", () => {
    render(<HomePage />);
    const cta = screen.getByRole("link", { name: "Judge Dancing with the Stars" });
    expect(cta.getAttribute("href")).toBe("https://dwts.armchairjudge.com");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Now it counts.");
  });

  it("links only the live show; coming-soon shows are not clickable", () => {
    render(<HomePage />);
    const shows = screen.getByRole("region", { name: "Pick your panel." });
    const links = within(shows).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://dwts.armchairjudge.com");
    for (const name of ["The Traitors", "Survivor"]) {
      const heading = within(shows).getByRole("heading", { name });
      expect(heading.closest("a")).toBeNull();
    }
  });

  it("labels the desk as invented data", () => {
    render(<HomePage />);
    expect(screen.getByText("Illustration · invented scores")).toBeTruthy();
  });

  it("carries the not-affiliated line", () => {
    render(<HomePage />);
    expect(screen.getByText(/Not affiliated with ABC, Disney, BBC, Peacock, CBS/)).toBeTruthy();
  });
});
