import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";
import { resetNotifications } from "@/lib/notifications";

import { SocialScreen } from "./social-screen";
import { calls, stubApi } from "./test-api";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: true }));

describe("social tab", () => {
  let fetchMock: ReturnType<typeof stubApi>;

  beforeEach(() => {
    resetMe();
    resetNotifications();
    fetchMock = stubApi();
  });

  afterEach(() => {
    document.cookie = "armchair_who=; Path=/; Max-Age=0";
  });

  it("links every person to their profile, signed in", async () => {
    render(<SocialScreen />);
    const friends = await screen.findByRole("region", { name: /Friends/ });
    const alex = await within(friends).findByRole("link", { name: "Alex Recliner" });
    expect(alex.getAttribute("href")).toBe("https://dwts.armchairjudge.com/profile/?u=u-1&sso=1");

    const groups = await screen.findByRole("region", { name: /Groups/ });
    const member = await within(groups).findByRole("link", { name: "Alex Recliner" });
    expect(member.getAttribute("href")).toBe("https://dwts.armchairjudge.com/profile/?u=u-1&sso=1");
  });

  it("accepts a friend request and reloads the list", async () => {
    render(<SocialScreen />);
    const friends = await screen.findByRole("region", { name: /Friends/ });
    await within(friends).findByText("Wants to be friends");
    fireEvent.click(within(friends).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(calls(fetchMock, "/friends/accept")).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, "/friends/accept")[0][1]?.body as string)).toEqual({ sub: "u-2" });
    await waitFor(() => expect(calls(fetchMock, "/friends/list")).toHaveLength(2));
  });

  it("puts the friend invite link on DWTS, where it is handled", async () => {
    render(<SocialScreen />);
    const link = await screen.findByLabelText("Or send your invite link");
    expect((link as HTMLInputElement).value).toBe("https://dwts.armchairjudge.com/friends/?add=CODE42");
  });

  it("joins a group from its invite, in the groups and notifications panels at once", async () => {
    render(<SocialScreen />);
    const groups = await screen.findByRole("region", { name: /Groups/ });
    await within(groups).findByText("Invited you to Ballroom Bench");

    fireEvent.click(within(groups).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(calls(fetchMock, "/groups/respond")).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, "/groups/respond")[0][1]?.body as string)).toEqual({ group: "g-2", accept: true });
    // The answer reloads the group list so the new group shows up.
    await waitFor(() => expect(calls(fetchMock, "/groups/mine")).toHaveLength(2));
  });

  it("creates a group from its name", async () => {
    render(<SocialScreen />);
    const name = await screen.findByLabelText("Start a group");
    fireEvent.change(name, { target: { value: "  Paddle Pals " } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Paddle Pals is ready. Invite people from Manage.")).toBeTruthy();
    expect(JSON.parse(calls(fetchMock, "/groups/create")[0][1]?.body as string)).toEqual({ name: "Paddle Pals" });
  });

  it("shows the group on each show: open where it plays, start where it doesn't", async () => {
    const show = (app: string, active: boolean, playing: string[]) => ({ app, active, by: null, at: null, playing });
    fetchMock = stubApi({
      "/groups/mine": () => ({
        data: [
          {
            id: "g-1",
            name: "Couch Crew",
            inviteCode: "G1",
            members: [{ sub: "me-1", name: "Pat Couch", picture: null, avatarKind: null, joinedAt: "2026-10-01T00:00:00Z" }],
            shows: [show("dwts", true, ["me-1"]), show("traitors", false, [])],
          },
        ],
      }),
      "/groups/shows": () => ({ data: { app: "traitors", active: true, started: true } }),
    });
    render(<SocialScreen />);
    const crew = await screen.findByRole("list", { name: "Couch Crew on each show" });
    expect(within(crew).getByRole("link", { name: "Open in DWTS" }).getAttribute("href")).toBe(
      "https://dwts.armchairjudge.com/groups/?id=g-1&sso=1",
    );
    expect(within(crew).getByRole("link", { name: "Start watching The Traitors" })).toBeTruthy();
    fireEvent.click(within(crew).getByRole("button", { name: "Start The Traitors with this group" }));
    await waitFor(() => expect(calls(fetchMock, "/groups/shows")).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, "/groups/shows")[0][1]?.body as string)).toEqual({ group: "g-1", app: "traitors", active: true });
  });

  it("shows a retry when a panel fails, and keeps the rest", async () => {
    fetchMock = stubApi({ "/friends/list": () => ({ status: 500 }) });
    render(<SocialScreen />);
    const friends = await screen.findByRole("region", { name: /Friends/ });
    expect((await within(friends).findByRole("alert")).textContent).toContain("Couldn’t load your friends");
    const groups = await screen.findByRole("region", { name: /Groups/ });
    expect(await within(groups).findByText("Couch Crew")).toBeTruthy();
  });

});
