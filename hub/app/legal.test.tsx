import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";

describe("legal pages", () => {
  it("privacy never promises an email contact and links to issues", () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeTruthy();
    expect(screen.getByText("Last updated 2026-09-30")).toBeTruthy();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.getAllByRole("link", { name: "GitHub issues page" })[0].getAttribute("href")).toBe(
      "https://github.com/domgiordano/armchair/issues",
    );
  });

  it("terms link back to privacy from the footer", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toMatch(/^\/privacy\/?$/);
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toMatch(/^\/terms\/?$/);
  });
});
