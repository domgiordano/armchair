import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { metadata, viewport } from "./layout";
import Home from "./page";

describe("shell", () => {
  it("renders the app name", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Armchair" })).toBeTruthy();
  });

  it("keeps the site out of search results", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("draws under the iPhone notch and home bar, which globals.css pads with the safe-area insets", () => {
    expect(viewport).toMatchObject({ width: "device-width", initialScale: 1, viewportFit: "cover" });
  });
});
