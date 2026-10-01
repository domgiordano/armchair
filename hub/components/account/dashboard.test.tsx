import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";
import { resetNotifications } from "@/lib/notifications";

import { Dashboard } from "./dashboard";
import { calls, stubApi } from "./test-api";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/amplify", () => ({ authConfigured: true }));

describe("signed-in dashboard", () => {
  let fetchMock: ReturnType<typeof stubApi>;

  beforeEach(() => {
    resetMe();
    resetNotifications();
    fetchMock = stubApi();
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
    expect(within(apps).getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
      "https://dwts.armchairjudge.com/?sso=1",
    );
    expect(within(apps).getByText("The Traitors").closest("a")).toBeNull();
  });

  it("links every person to their profile, signed in", async () => {
    render(<Dashboard />);
    const friends = screen.getByRole("region", { name: /Friends/ });
    const alex = await within(friends).findByRole("link", { name: "Alex Recliner" });
    expect(alex.getAttribute("href")).toBe("https://dwts.armchairjudge.com/profile/?u=u-1&sso=1");

    const groups = screen.getByRole("region", { name: /Groups/ });
    const member = await within(groups).findByRole("link", { name: "Alex Recliner" });
    expect(member.getAttribute("href")).toBe("https://dwts.armchairjudge.com/profile/?u=u-1&sso=1");
  });

  it("accepts a friend request and reloads the list", async () => {
    render(<Dashboard />);
    const friends = screen.getByRole("region", { name: /Friends/ });
    await within(friends).findByText("Wants to be friends");
    fireEvent.click(within(friends).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(calls(fetchMock, "/friends/accept")).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, "/friends/accept")[0][1]?.body as string)).toEqual({ sub: "u-2" });
    await waitFor(() => expect(calls(fetchMock, "/friends/list")).toHaveLength(2));
  });

  it("puts the friend invite link on DWTS, where it is handled", async () => {
    render(<Dashboard />);
    const link = await screen.findByLabelText("Or send your invite link");
    expect((link as HTMLInputElement).value).toBe("https://dwts.armchairjudge.com/friends/?add=CODE42");
  });

  it("joins a group from its invite, in the groups and notifications panels at once", async () => {
    render(<Dashboard />);
    const groups = screen.getByRole("region", { name: /Groups/ });
    await within(groups).findByText("Invited you to Ballroom Bench");
    expect(screen.getByRole("region", { name: /Notifications/ }).textContent).toContain("1 unread");

    fireEvent.click(within(groups).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(calls(fetchMock, "/groups/respond")).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, "/groups/respond")[0][1]?.body as string)).toEqual({ group: "g-2", accept: true });
    // The answer reloads the group list so the new group shows up.
    await waitFor(() => expect(calls(fetchMock, "/groups/mine")).toHaveLength(2));
  });

  it("creates a group from its name", async () => {
    render(<Dashboard />);
    const name = await screen.findByLabelText("Start a group");
    fireEvent.change(name, { target: { value: "  Paddle Pals " } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Paddle Pals is ready. Invite people from Manage.")).toBeTruthy();
    expect(JSON.parse(calls(fetchMock, "/groups/create")[0][1]?.body as string)).toEqual({ name: "Paddle Pals" });
  });

  it("shows a retry when a panel fails, and keeps the rest", async () => {
    fetchMock = stubApi({ "/friends/list": () => ({ status: 500 }) });
    render(<Dashboard />);
    const friends = screen.getByRole("region", { name: /Friends/ });
    expect((await within(friends).findByRole("alert")).textContent).toContain("Couldn’t load your friends");
    expect(await screen.findByRole("heading", { level: 1, name: /Welcome back/ })).toBeTruthy();
  });

  it("remembers who signed in, for the one-tap button next time", async () => {
    render(<Dashboard />);
    await screen.findByRole("heading", { level: 1, name: /Welcome back/ });
    expect(decodeURIComponent(document.cookie)).toContain('armchair_who={"name":"Pat Couch","picture":null}');
  });
});
