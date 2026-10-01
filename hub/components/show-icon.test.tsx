import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShowIcon, type Show } from "./show-icon";
import styles from "./show-icon.module.css";

const SHOWS: Show[] = ["dwts", "traitors", "survivor"];
const realMatchMedia = window.matchMedia;

function reduceMotion() {
  window.matchMedia = ((media: string) => ({
    matches: media.includes("reduce"),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe("ShowIcon", () => {
  it("draws each show as a decorative tile at the requested size", () => {
    for (const show of SHOWS) {
      const { container, unmount } = render(<ShowIcon show={show} size={64} />);
      const icon = container.querySelector(`[data-show="${show}"]`) as HTMLElement;
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.style.width).toBe("64px");
      expect(icon.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 64 64");
      unmount();
    }
  });

  it("gives every instance its own gradient ids, so one hidden copy can't blank the rest", () => {
    const { container } = render(
      <>
        <ShowIcon show="dwts" />
        <ShowIcon show="dwts" />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses fewer, bigger mirrors on a small ball", () => {
    const mirrors = (size: number) => {
      const { container, unmount } = render(<ShowIcon show="dwts" size={size} />);
      const n = container.querySelectorAll(`.${styles.facet}`).length;
      unmount();
      return n;
    };
    expect(mirrors(24)).toBeGreaterThan(0);
    expect(mirrors(24)).toBeLessThan(mirrors(44));
    expect(mirrors(44)).toBeLessThan(mirrors(96));
  });

  it("throws specks off the ball and embers off the torch when motion is allowed", () => {
    const { container } = render(
      <>
        <ShowIcon show="dwts" />
        <ShowIcon show="survivor" />
      </>,
    );
    expect(container.querySelectorAll(`.${styles.speck}`).length).toBe(4);
    expect(container.querySelectorAll(`.${styles.ember}`).length).toBe(5);
  });

  it("leaves the particles out under reduced motion but still draws the art", () => {
    reduceMotion();
    const { container } = render(
      <>
        {SHOWS.map((show) => (
          <ShowIcon key={show} show={show} />
        ))}
      </>,
    );
    expect(container.querySelector(`.${styles.fx}`)).toBeNull();
    expect(container.querySelectorAll(`.${styles.facet}`).length).toBeGreaterThan(0);
    expect(container.querySelectorAll(`.${styles.flicker}`).length).toBe(2);
  });

  it("padlocks a coming-soon icon once it is big enough to read", () => {
    const lock = (size: number, locked: boolean) => {
      const { container, unmount } = render(<ShowIcon show="traitors" size={size} locked={locked} />);
      const icon = container.querySelector("[data-show]") as HTMLElement;
      const out = { muted: icon.classList.contains(styles.locked), lock: !!icon.querySelector(`.${styles.lock}`) };
      unmount();
      return out;
    };
    expect(lock(44, true)).toEqual({ muted: true, lock: true });
    expect(lock(24, true)).toEqual({ muted: true, lock: false });
    expect(lock(44, false)).toEqual({ muted: false, lock: false });
  });
});
