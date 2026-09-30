import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INTRO_MS, Intro } from "@/components/intro";
import { INTRO_KEY, introSkipScript } from "@/lib/intro";

const stage = () => screen.queryByRole("region", { name: "Armchair Judge intro" });

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderPage() {
  return render(
    <>
      <Intro />
      <div id="page">
        <main id="main" tabIndex={-1}>
          <a href="/x">Landing link</a>
        </main>
      </div>
    </>,
  );
}

describe("Intro", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Not unstubAllGlobals: that would also drop the setup file's localStorage stub.
    setReducedMotion(false);
  });

  it("plays on the first visit, then hands off to the landing", () => {
    renderPage();
    expect(stage()).not.toBeNull();
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");

    act(() => vi.advanceTimersByTime(INTRO_MS));

    expect(stage()).toBeNull();
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    expect(sessionStorage.getItem(INTRO_KEY)).toBe("1");
  });

  it("plays once per session", () => {
    sessionStorage.setItem(INTRO_KEY, "1");
    renderPage();
    expect(stage()).toBeNull();
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(false);
  });

  it("skips straight to the landing and moves keyboard focus onto it", () => {
    renderPage();
    const skip = screen.getByRole("button", { name: "Skip" });
    skip.focus();
    fireEvent.click(skip);

    expect(stage()).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("main"));
    expect(sessionStorage.getItem(INTRO_KEY)).toBe("1");
  });

  it("hides the server-rendered stage before paint on a returning visit", () => {
    sessionStorage.setItem(INTRO_KEY, "1");
    new Function(introSkipScript)();
    expect(document.documentElement.dataset.intro).toBe("skip");
    delete document.documentElement.dataset.intro;
  });

  it("does not play under prefers-reduced-motion", () => {
    setReducedMotion(true);
    renderPage();
    expect(stage()).toBeNull();
  });

  it("still plays and ends when sessionStorage is blocked", () => {
    const blocked = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);

    renderPage();
    expect(stage()).not.toBeNull();
    act(() => vi.advanceTimersByTime(INTRO_MS));
    expect(stage()).toBeNull();

    vi.restoreAllMocks();
  });
});
