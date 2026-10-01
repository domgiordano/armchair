import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollReveals } from "@/components/scroll-reveals";

const enters: (() => void)[] = [];

class FakeObserver {
  constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {
    enters.push(() => this.cb([{ isIntersecting: true }]));
  }
  observe() {}
  disconnect() {}
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: reduce && media.includes("reduce"),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderPage() {
  return render(
    <>
      <ScrollReveals />
      <h2 data-reveal="">Shows</h2>
    </>,
  );
}

describe("ScrollReveals", () => {
  beforeEach(() => {
    enters.length = 0;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });

  afterEach(() => setReducedMotion(false));

  it("hides reveal targets until each scrolls into view", () => {
    const { getByText } = renderPage();
    expect(document.documentElement.classList.contains("reveals")).toBe(true);
    expect(getByText("Shows").hasAttribute("data-shown")).toBe(false);

    act(() => enters[0]());
    expect(getByText("Shows").hasAttribute("data-shown")).toBe(true);
  });

  it("leaves everything visible under reduced motion", () => {
    setReducedMotion(true);
    renderPage();
    expect(document.documentElement.classList.contains("reveals")).toBe(false);
    expect(enters).toHaveLength(0);
  });
});
