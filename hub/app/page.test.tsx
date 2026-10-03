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

  it("leads with both live shows, each with its own way in", () => {
    render(<HomePage />);
    expect(screen.getByText("Play along with the shows you watch")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Judge Dancing with the Stars" })[0].getAttribute("href")).toBe("https://dwts.armchairjudge.com/?sso=1");
    expect(screen.getAllByRole("link", { name: "Play The Traitors" })[0].getAttribute("href")).toBe("https://traitors.armchairjudge.com/?sso=1");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Now it counts.");
    // The show cards come straight after the hero.
    const sections = [...document.querySelectorAll("main > section[id]")].map((s) => s.id);
    expect(sections.slice(0, 2)).toEqual(["top", "shows"]);
  });

  it("explains how each live show plays and scores, with its own demo", () => {
    render(<HomePage />);
    const play = screen.getByRole("region", { name: /call it before you see it/ });
    const dwts = within(play).getByRole("article", { name: "Dancing with the Stars" });
    expect(within(dwts).getByRole("img", { name: /^Week 3 · Foxtrot\. You held up 7\. Rhea 7, Marco 8, Dee 6\. Closest to Rhea\./ })).toBeTruthy();
    expect(dwts.textContent).toContain("judge by judge");
    const traitors = within(play).getByRole("article", { name: "The Traitors" });
    expect(within(traitors).getByRole("img", { name: /Wren banished\. Your slate scores 10 points\./ })).toBeTruthy();
    expect(traitors.textContent).toContain("Exact slots score 5, 3 and 2");
  });

  it("shows one group ranked on each show's own board", () => {
    render(<HomePage />);
    const friends = screen.getByRole("region", { name: "One crew, every show." });
    expect(within(friends).getByRole("img", { name: /Dancing with the Stars, Points off the judges: 1 Priya ±0\.42, 2 You ±0\.55/ })).toBeTruthy();
  });

  it("shows a Traitors slate beside the desk, with invented names", () => {
    render(<HomePage />);
    expect(screen.getByRole("img", { name: /^The Traitors, episode 4\. Your round table top 3: Wren, Otis, Mara/ })).toBeTruthy();
    expect(screen.getByText("Illustration · invented names")).toBeTruthy();
  });

  it("links the live shows; the coming-soon show is not clickable", () => {
    render(<HomePage />);
    const shows = screen.getByRole("region", { name: "Pick your panel." });
    const links = within(shows).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://dwts.armchairjudge.com/?sso=1",
      "https://traitors.armchairjudge.com/?sso=1",
    ]);
    expect(within(shows).getByRole("heading", { name: "Survivor" }).closest("a")).toBeNull();
  });

  it("runs a ticker of what's on under the hero, from public copy", () => {
    render(<HomePage />);
    const ticker = screen.getByRole("region", { name: "What's on" });
    expect(ticker.previousElementSibling?.id).toBe("top");
    const text = within(ticker).getAllByRole("listitem").map((li) => li.textContent);
    expect(text).toContain("Dancing with the Stars: Live on the East Coast, 8 to 10 PM ET");
    expect(text).toContainEqual(expect.stringMatching(/^Archive: \d+ DWTS seasons/));
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
    const numbers = screen.getByRole("region", { name: /Dancing with the Stars, every season/ });
    const seasons = readdirSync(path.join(process.cwd(), "..", "fixtures", "seasons")).filter((f) => f.endsWith(".json"));
    const value = (label: string) => within(numbers).getByText(label).parentElement?.querySelector(".sr-only")?.textContent;
    expect(value("Seasons covered")).toBe(String(seasons.length));
    expect(Number(value("Judges' scores loaded")?.replace(/,/g, ""))).toBeGreaterThan(Number(value("Performances")?.replace(/,/g, "")));
  });

  it("footer links every app, the legal pages, GitHub and Xomware", () => {
    render(<HomePage />);
    const footer = screen.getByRole("contentinfo");
    const href = (name: string) => within(footer).getByRole("link", { name }).getAttribute("href");
    expect(within(footer).getByRole("link", { name: /^Dancing with the Stars/ }).getAttribute("href")).toBe("https://dwts.armchairjudge.com/?sso=1");
    expect(within(footer).getByRole("link", { name: /^The Traitors/ }).getAttribute("href")).toBe("https://traitors.armchairjudge.com/?sso=1");
    const apps = within(footer).getByRole("navigation", { name: "Apps" });
    expect(apps.textContent).toMatch(/Armchair Judge.*Dancing with the Stars.*The Traitors.*Survivor/);
    expect(within(footer).getByText("Survivor").closest("a")).toBeNull();
    expect(href("GitHub")).toBe("https://github.com/domgiordano/armchair");
    expect(href("A Xomware app")).toBe("https://xomware.com");
    expect(href("Photo credits")).toBe("https://dwts.armchairjudge.com/credits/?sso=1");
    expect(href("FAQ")).toBe("/#faq");
  });

  it("carries the not-affiliated line", () => {
    render(<HomePage />);
    expect(screen.getByText(/Not affiliated with .*The Traitors, ABC, Disney, NBC, Peacock, BBC, CBS/)).toBeTruthy();
  });
});
