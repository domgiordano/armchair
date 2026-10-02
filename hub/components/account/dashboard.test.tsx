import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";
import { resetNotifications } from "@/lib/notifications";

import { Dashboard } from "./dashboard";
import { stubApi } from "./test-api";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/amplify", () => ({ authConfigured: true }));

describe("signed-in dashboard", () => {
  beforeEach(() => {
    resetMe();
    resetNotifications();
    stubApi();
  });

  afterEach(() => {
    document.cookie = "armchair_who=; Path=/; Max-Age=0";
  });

  it("welcomes the member by first name and shows their DWTS season", async () => {
    render(<Dashboard />);
    expect(await screen.findByRole("heading", { level: 1, name: /Welcome back, Pat\./ })).toBeTruthy();

    const shows = screen.getByRole("region", { name: "Your shows" });
    const dwts = within(shows).getByRole("article", { name: "Dancing with the Stars" });
    await within(dwts).findByText("Season 35 · 2026");
    const stat = (label: string) => within(dwts).getByText(label).parentElement?.textContent;
    expect(stat("Accuracy")).toContain("0.87");
    expect(stat("Accuracy")).toContain("over 14 dances");
    expect(stat("Rank")).toContain("#2");
    expect(stat("Rank")).toContain("of 4");
    // Episode 1 has aired; the next is the first air date from today on.
    expect(stat("Next episode")).toContain("E9");
    expect(within(dwts).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("https://dwts.armchairjudge.com/?sso=1");
    expect(within(shows).getByText("Survivor").closest("a")).toBeNull();
  });

  it("gives each current Traitors season a card: points, rank and next episode, or the winner bet first", async () => {
    render(<Dashboard />);
    const shows = await screen.findByRole("region", { name: "Your shows" });
    const us = await within(shows).findByRole("article", { name: "The Traitors US" });
    const stat = (label: string) => within(us).getByText(label).parentElement?.textContent;
    expect(stat("Points")).toContain("12");
    expect(stat("Rank")).toContain("#3");
    expect(stat("Rank")).toContain("of 25");
    expect(stat("Next episode")).toContain("E6");
    expect(within(us).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("https://traitors.armchairjudge.com/?sso=1");

    const celeb = within(shows).getByRole("article", { name: "The Traitors Celebrity UK" });
    expect(within(celeb).getByRole("link", { name: "Lock in your winners" }).getAttribute("href")).toBe(
      "https://traitors.armchairjudge.com/?sso=1",
    );
    expect(within(celeb).queryByText("Points")).toBeNull();
  });

  it("leaves one Traitors card as just a link when the API won't show any season", async () => {
    stubApi({ "/traitors/stats": () => ({ status: 404 }) });
    render(<Dashboard />);
    const shows = await screen.findByRole("region", { name: "Your shows" });
    await waitFor(() => expect(within(shows).queryByText("Loading your Traitors seasons...")).toBeNull());
    const card = within(shows).getByRole("article", { name: "The Traitors" });
    expect(within(card).getByText("US and UK")).toBeTruthy();
    expect(within(card).queryByText("Points")).toBeNull();
    expect(within(card).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("https://traitors.armchairjudge.com/?sso=1");
  });

  it("remembers who signed in, for the one-tap button next time", async () => {
    render(<Dashboard />);
    await screen.findByRole("heading", { level: 1, name: /Welcome back/ });
    expect(decodeURIComponent(document.cookie)).toContain('armchair_who={"name":"Pat Couch","picture":null}');
  });

  it("puts each tab one tap away", async () => {
    render(<Dashboard />);
    await screen.findByRole("heading", { level: 1, name: /Welcome back/ });
    const tabs = screen.getByRole("navigation", { name: "Main" });
    expect(within(tabs).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    for (const name of ["Stats", "Leaderboards", "Social"]) expect(within(tabs).getByRole("link", { name })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Notifications/ })).toBeTruthy();
  });
});
