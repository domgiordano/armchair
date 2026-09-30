import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INTRO_MS, Intro } from "@/components/intro";

const sceneRendered = vi.fn();
vi.mock("@/components/intro-3d/scene", () => ({
  IntroScene: () => {
    sceneRendered();
    return null;
  },
}));

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
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Not unstubAllGlobals: that would also drop the setup file's localStorage stub.
    setReducedMotion(false);
  });

  it("plays, then hands off to the landing", () => {
    renderPage();
    expect(stage()).not.toBeNull();
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");

    act(() => vi.advanceTimersByTime(INTRO_MS));

    expect(stage()).toBeNull();
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("plays again on the next load", () => {
    const first = renderPage();
    act(() => vi.advanceTimersByTime(INTRO_MS));
    first.unmount();

    renderPage();
    expect(stage()).not.toBeNull();
  });

  it("skips straight to the landing and moves keyboard focus onto it", () => {
    renderPage();
    const skip = screen.getByRole("button", { name: "Skip" });
    skip.focus();
    fireEvent.click(skip);

    expect(stage()).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("main"));
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(false);
  });

  it("does not play under prefers-reduced-motion", () => {
    setReducedMotion(true);
    renderPage();
    expect(stage()).toBeNull();
    expect(document.getElementById("page")?.hasAttribute("inert")).toBe(false);
  });

  it("keeps the static mark and never loads the 3D stage without WebGL", async () => {
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(stage()?.querySelector("svg.intro-poster")).not.toBeNull();
    expect(stage()?.querySelector("canvas")).toBeNull();
    expect(stage()?.dataset.scene).toBeUndefined();
    expect(sceneRendered).not.toHaveBeenCalled();
  });
});
