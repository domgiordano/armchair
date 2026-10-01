import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscoLoader, PageLoader } from "./disco-loader";

describe("DiscoLoader", () => {
  it("announces its label politely and hides the ball from screen readers", () => {
    const { container } = render(<DiscoLoader label="Loading the leaderboard" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Loading the leaderboard");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("says Loading when given no label", () => {
    render(<DiscoLoader />);
    expect(screen.getByRole("status").textContent).toBe("Loading");
  });

  it("draws 24, 48 and 96 px balls, with thrown specks only when there's room", () => {
    const sizes = (["sm", "md", "lg"] as const).map((size) => {
      const { container, unmount } = render(<DiscoLoader size={size} />);
      const svg = container.querySelector("svg");
      const out = { px: svg?.getAttribute("width"), tiles: svg?.querySelectorAll("polygon").length ?? 0 };
      const specks = container.querySelectorAll("[role=status] > span[aria-hidden]").length;
      unmount();
      return { ...out, specks };
    });
    expect(sizes.map((s) => s.px)).toEqual(["24", "48", "96"]);
    expect(sizes.map((s) => s.specks)).toEqual([0, 4, 4]);
    expect(sizes[0].tiles).toBeLessThan(sizes[1].tiles);
  });
});

describe("PageLoader", () => {
  it("shows one large loader carrying the label", () => {
    const { container } = render(<PageLoader label="Loading the episode" />);
    expect(screen.getByRole("status").textContent).toBe("Loading the episode");
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("96");
  });
});
