import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Credit } from "@/components/credits";

const commons = {
  name: "Derek Hough",
  headshot: {
    file: "Derek_Hough.jpg",
    image: "derek-hough-0123456789.webp",
    author: "Jane Doe",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Derek_Hough.jpg",
  },
};
const supplied = {
  name: "Witney Carson",
  headshot: {
    image: "supplied/witney-carson-0123456789.webp",
    author: "Supplied",
    license: "Used with permission",
    sourceUrl: null,
    source: "supplied" as const,
  },
};

describe("Credit", () => {
  it("credits a Commons photo to its author and license, linking the file", () => {
    render(<Credit person={commons} />);
    expect(screen.getByText("Jane Doe · CC BY 2.0")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(commons.headshot.sourceUrl);
  });

  it("marks a supplied photo as supplied, with no license or Commons link", () => {
    const { container } = render(<Credit person={supplied} />);
    expect(screen.getByText("Photo supplied")).toBeTruthy();
    expect(screen.queryByText(/Used with permission|Supplied ·/)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(
      /\/headshots\/supplied\/witney-carson-0123456789\.webp$/,
    );
  });
});
