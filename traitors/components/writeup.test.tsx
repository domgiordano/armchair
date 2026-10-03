import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Credit } from "./writeup";

describe("Credit", () => {
  it("says a recap was written from the results, with no wiki link", () => {
    render(<Credit writeup={{ text: "x", source: "results", sourceUrl: null }} />);
    expect(screen.getByText("Written from the episode's confirmed results")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links the Fandom source", () => {
    render(<Credit writeup={{ text: "x", source: "fandom", sourceUrl: "https://thetraitors.fandom.com/wiki/X" }} />);
    expect(screen.getByRole("link", { name: /Traitors Wiki/ }).getAttribute("href")).toBe("https://thetraitors.fandom.com/wiki/X");
  });
});
