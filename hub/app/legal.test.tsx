import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";

describe("legal pages", () => {
  it("privacy never promises an email contact and links to issues", () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeTruthy();
    expect(screen.getByText("Last updated 2026-10-08")).toBeTruthy();
    expect(screen.getByText(/no third-party analytics, advertising or tracking/)).toBeTruthy();
    expect(screen.getByText(/Do-Not-Track or Global Privacy Control, we record nothing/)).toBeTruthy();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.getAllByRole("link", { name: "GitHub issues page" })[0].getAttribute("href")).toBe(
      "https://github.com/domgiordano/armchair/issues",
    );
  });

  it("privacy covers every section Google's OAuth review looks for", () => {
    render(<PrivacyPage />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(
      expect.arrayContaining([
        "Who we are",
        "Information we collect",
        "How we use it",
        "How we share it",
        "Google API Services User Data Policy",
        "Storage and security",
        "Retention",
        "Your choices and deletion",
        "Children",
        "Changes to this policy",
        "Contact",
      ]),
    );
    expect(screen.getByText(/including the Limited Use requirements/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Google API Services User Data Policy" }).getAttribute("href")).toBe(
      "https://developers.google.com/terms/api-services-user-data-policy",
    );
    expect(screen.getByRole("link", { name: "myaccount.google.com/permissions" }).getAttribute("href")).toBe(
      "https://myaccount.google.com/permissions",
    );
  });

  it("terms link back to privacy from the footer", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toMatch(/^\/privacy\/?$/);
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toMatch(/^\/terms\/?$/);
  });
});
