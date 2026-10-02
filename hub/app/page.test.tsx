import { readdirSync } from "node:fs";
import path from "node:path";

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

  it("links the live shows; the coming-soon show is not clickable", () => {
    render(<HomePage />);
    const shows = screen.getByRole("region", { name: "Pick your panel." });
    const links = within(shows).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://dwts.armchairjudge.com",
      "https://traitors.armchairjudge.com",
    ]);
    expect(within(shows).getByRole("heading", { name: "Survivor" }).closest("a")).toBeNull();
  });

  it("labels the desk as invented data", () => {
    render(<HomePage />);
    expect(screen.getByText("Illustration · invented scores")).toBeTruthy();
  });

  it("marks what isn't live yet instead of implying it ships today", () => {
    render(<HomePage />);
    const card = screen.getByRole("heading", { name: "Every past season" }).closest("li") as HTMLElement;
    expect(within(card).getByText("COMING SOON")).toBeTruthy();
  });

  it("says plainly that paddles are not votes on the show", () => {
    render(<HomePage />);
    const q = screen.getByText("Does my score count as a vote on the show?").closest("details") as HTMLElement;
    expect(q.textContent).toMatch(/No\. Paddles here .* never reach the show/);
  });

  it("keeps the About section Google's brand review reads", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /what it does with your Google account/ })).toBeTruthy();
  });

  it("counts the catalog it was built from", () => {
    render(<HomePage />);
    const numbers = screen.getByRole("region", { name: /Every season of Dancing with the Stars/ });
    const seasons = readdirSync(path.join(process.cwd(), "..", "fixtures", "seasons")).filter((f) => f.endsWith(".json"));
    const value = (label: string) => within(numbers).getByText(label).parentElement?.querySelector(".sr-only")?.textContent;
    expect(value("Seasons covered")).toBe(String(seasons.length));
    expect(Number(value("Judges' scores loaded")?.replace(/,/g, ""))).toBeGreaterThan(Number(value("Performances")?.replace(/,/g, "")));
  });

  it("footer links every app, the legal pages, GitHub and Xomware", () => {
    render(<HomePage />);
    const footer = screen.getByRole("contentinfo");
    const href = (name: string) => within(footer).getByRole("link", { name }).getAttribute("href");
    expect(within(footer).getByRole("link", { name: /^Dancing with the Stars/ }).getAttribute("href")).toBe("https://dwts.armchairjudge.com");
    expect(within(footer).getByRole("link", { name: /^The Traitors/ }).getAttribute("href")).toBe("https://traitors.armchairjudge.com");
    expect(within(footer).getByText("Survivor").closest("a")).toBeNull();
    expect(href("GitHub")).toBe("https://github.com/domgiordano/armchair");
    expect(href("A Xomware app")).toBe("https://xomware.com");
    expect(href("Photo credits")).toBe("https://dwts.armchairjudge.com/credits/");
    expect(href("FAQ")).toBe("/#faq");
  });

  it("carries the not-affiliated line", () => {
    render(<HomePage />);
    expect(screen.getByText(/Not affiliated with .*The Traitors, ABC, Disney, NBC, Peacock, BBC, CBS/)).toBeTruthy();
  });
});
