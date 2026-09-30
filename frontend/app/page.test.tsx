import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/font is a build-time transform; outside Next it has no loader.
vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "font-poppins", className: "font-poppins" }),
}));

import { metadata, viewport } from "./layout";
import Home from "./page";

describe("shell", () => {
  it("renders the app name", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Armchair Judge" })).toBeTruthy();
  });

  it("titles pages as Armchair Judge for the show", () => {
    expect(metadata.title).toEqual({
      default: "Armchair Judge · Dancing with the Stars",
      template: "%s · Armchair Judge",
    });
  });

  it("keeps the site out of search results", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("draws under the iPhone notch and home bar, which globals.css pads with the safe-area insets", () => {
    expect(viewport).toMatchObject({ width: "device-width", initialScale: 1, viewportFit: "cover" });
  });
});
