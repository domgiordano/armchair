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

    const apps = screen.getByRole("region", { name: "Your apps" });
    await within(apps).findByText("Season 35 · 2026");
    const stat = (label: string) => within(apps).getByText(label).parentElement?.textContent;
    expect(stat("Dances scored")).toContain("14");
    expect(stat("Accuracy")).toContain("0.87");
    expect(stat("Rank")).toContain("#2");
    expect(stat("Rank")).toContain("of 4");
    const [dwts, traitors] = within(apps).getAllByRole("link", { name: "Open" });
    expect(dwts.getAttribute("href")).toBe("https://dwts.armchairjudge.com/?sso=1");
    expect(traitors.getAttribute("href")).toBe("https://traitors.armchairjudge.com/?sso=1");
    expect(within(apps).getByText("Survivor").closest("a")).toBeNull();
  });

  it("shows Traitors points for each current season", async () => {
    render(<Dashboard />);
    const apps = await screen.findByRole("region", { name: "Your apps" });
    expect((await within(apps).findByText("US · Season 5")).parentElement?.textContent).toContain("12 pts");
    expect(within(apps).getByText("Celebrity UK · Season 2")).toBeTruthy();
  });

  it("leaves the Traitors tile as just a link when the API won't show the season", async () => {
    stubApi({ "/traitors/stats": () => ({ status: 404 }) });
    render(<Dashboard />);
    const apps = await screen.findByRole("region", { name: "Your apps" });
    await within(apps).findByText("Season 35 · 2026");
    await waitFor(() => expect(within(apps).queryByText("Loading your points...")).toBeNull());
    expect(within(apps).queryByText(/pts/)).toBeNull();
    expect(within(apps).getAllByRole("link", { name: "Open" })).toHaveLength(2);
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
