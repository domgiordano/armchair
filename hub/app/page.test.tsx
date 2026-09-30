import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("hub", () => {
  it("links to the Dancing with the Stars app", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "Judge Dancing with the Stars" }).getAttribute("href")).toBe(
      "https://dwts.xomware.com",
    );
  });
});
