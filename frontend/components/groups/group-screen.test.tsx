import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/groups/",
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.params,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getMe: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/leaderboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/leaderboard")>()),
  getLeaderboard: vi.fn(),
}));
vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getFriends: vi.fn(),
  mySub: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));
vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  getGroupDetails: vi.fn(),
  inviteToGroup: vi.fn(),
  manageGroup: vi.fn(),
  leaveGroup: vi.fn(),
  deleteGroup: vi.fn(),
  respondToInvite: vi.fn(),
}));

import {
  deleteGroup,
  getGroupDetails,
  inviteToGroup,
  leaveGroup,
  manageGroup,
  respondToInvite,
  type GroupDetail,
} from "@/lib/api/groups";
import { getLeaderboard, type Leaderboard } from "@/lib/api/leaderboard";
import { getSeason, type Season } from "@/lib/api/show";
import { getFriends, getNotifications, mySub, type Friends, type Notification } from "@/lib/api/social";
import { resetNotifications } from "@/lib/social/notifications";
import { readGroup } from "@/lib/show/group-filter";
import { GroupRoute } from "./group-screen";

const person = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const });
const GID = "g".repeat(12);
const ME = "me";

const group = (over: Partial<GroupDetail> = {}): GroupDetail => ({
  id: GID,
  name: "Family",
  inviteCode: "c".repeat(16),
  owner: ME,
  approval: false,
  members: [person(ME, "Me Myself"), person("b", "Bea Arthur")],
  invited: [],
  requests: [person("e", "Eve Arden")],
  ...over,
});

const FRIENDS: Friends = {
  inviteCode: "k".repeat(16),
  friends: [
    { ...person("b", "Bea Arthur"), at: null },
    { ...person("c", "Carol Burnett"), at: null },
  ],
  incoming: [],
  outgoing: [],
  blocked: [],
};

const SEASON: Season = { season: "dwts-35", open: false, timezone: "America/New_York", episodes: [], judges: [], contestants: [] };

const BOARD: Leaderboard = {
  season: "dwts-35",
  scope: "group",
  group: GID,
  minDances: 5,
  ranked: [
    { rank: 1, ...person("b", "Bea Arthur"), count: 10, mae: 0.8, closestJudge: null },
    { rank: 2, ...person(ME, "Me Myself"), count: 6, mae: 1.2, closestJudge: null },
  ],
  unranked: [],
  me: { rank: 2, ...person(ME, "Me Myself"), count: 6, mae: 1.2, closestJudge: null },
};

beforeEach(() => {
  nav.params = new URLSearchParams({ id: GID });
  vi.mocked(getGroupDetails).mockResolvedValue([group()]);
  vi.mocked(mySub).mockResolvedValue(ME);
  vi.mocked(getFriends).mockResolvedValue(FRIENDS);
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getLeaderboard).mockResolvedValue(BOARD);
  vi.mocked(getNotifications).mockResolvedValue({ items: [], unread: 0, next: null });
  resetNotifications();
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GroupRoute", () => {
  it("sends a bare /groups/ to your groups list", () => {
    nav.params = new URLSearchParams();
    render(<GroupRoute />);
    expect(nav.replace).toHaveBeenCalledWith("/profile/?sheet=groups");
  });

  it("heads the page with the group, its people and your role", async () => {
    render(<GroupRoute />);
    expect(await screen.findByRole("heading", { level: 1, name: "Family" })).toBeTruthy();
    expect(screen.getByText("2 members")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Members, 1 waiting" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Scorecard" }));
    expect(readGroup()).toBe(GID);
  });

  it("opens on the group's leaderboard and numbers", async () => {
    render(<GroupRoute />);
    const numbers = await screen.findByLabelText("Group numbers");
    expect(getLeaderboard).toHaveBeenCalledWith("dwts-35", "group", GID);
    expect(numbers.textContent).toContain("Bea Arthur");
    expect(numbers.textContent).toContain("#2");
    expect(numbers.textContent).toContain("1.00");
    expect(numbers.textContent).toContain("2/2");
  });

  it("lets the owner answer join requests and remove members", async () => {
    vi.mocked(manageGroup).mockResolvedValue({ ok: true });
    render(<GroupRoute />);
    fireEvent.click(await screen.findByRole("tab", { name: "Members, 1 waiting" }));
    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getByRole("button", { name: "Let in" }));
    await vi.waitFor(() => expect(manageGroup).toHaveBeenCalledWith(GID, { action: "approve", sub: "e" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Remove" }));
    await vi.waitFor(() => expect(manageGroup).toHaveBeenCalledWith(GID, { action: "remove", sub: "b" }));
  });

  it("invites friends who aren't in yet, and shows the link", async () => {
    vi.mocked(inviteToGroup).mockResolvedValue({ status: "invited" });
    render(<GroupRoute />);
    fireEvent.click(await screen.findByRole("button", { name: "Invite" }));
    const sheet = screen.getByRole("dialog", { name: "Invite to Family" });
    expect((within(sheet).getByRole("textbox", { name: "Group link" }) as HTMLInputElement).value).toContain(`/join/?code=${"c".repeat(16)}`);
    expect(within(sheet).queryByText("Bea Arthur")).toBeNull();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Invite" }));
    expect(await within(sheet).findByText("Invited")).toBeTruthy();
    expect(inviteToGroup).toHaveBeenCalledWith(GID, "c");
  });

  it("keeps renaming, approval and delete in the owner's settings", async () => {
    vi.mocked(manageGroup).mockResolvedValue({ ok: true });
    vi.mocked(deleteGroup).mockResolvedValue({ ok: true });
    render(<GroupRoute />);
    fireEvent.click(await screen.findByRole("button", { name: "Group options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Group settings" }));
    const sheet = screen.getByRole("dialog", { name: "Group settings" });
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Name" }), { target: { value: "The Fam" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(manageGroup).toHaveBeenCalledWith(GID, { action: "rename", name: "The Fam" }));

    fireEvent.click(screen.getByRole("button", { name: "Group options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Group settings" }));
    const again = screen.getByRole("dialog", { name: "Group settings" });
    fireEvent.click(within(again).getByRole("switch", { name: "Approve people who join by link" }));
    await vi.waitFor(() => expect(manageGroup).toHaveBeenCalledWith(GID, { action: "approval", approval: true }));
    fireEvent.click(within(again).getByRole("button", { name: "Delete group" }));
    fireEvent.click(within(again).getByRole("button", { name: "Delete for everyone" }));
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/profile/?sheet=groups"));
    expect(deleteGroup).toHaveBeenCalledWith(GID);
  });

  it("lets a member leave, after asking", async () => {
    vi.mocked(getGroupDetails).mockResolvedValue([group({ owner: "b", requests: [] })]);
    vi.mocked(leaveGroup).mockResolvedValue({ ok: true });
    render(<GroupRoute />);
    expect(await screen.findByText("Member")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Group options" }));
    expect(screen.queryByRole("menuitem", { name: "Group settings" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Leave group" }));
    const sheet = screen.getByRole("dialog", { name: "Leave Family?" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Leave group" }));
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/profile/?sheet=groups"));
    expect(leaveGroup).toHaveBeenCalledWith(GID);
  });

  it("offers to join when you're invited but not in yet", async () => {
    vi.mocked(getGroupDetails).mockResolvedValueOnce([]).mockResolvedValue([group()]);
    const invite: Notification = {
      id: "n1",
      type: "group_invite",
      read: false,
      state: "pending",
      at: "2026-09-30T12:00:00+00:00",
      from: person("b", "Bea Arthur"),
      group: { id: GID, name: "Family" },
    };
    vi.mocked(getNotifications).mockResolvedValue({ items: [invite], unread: 1, next: null });
    vi.mocked(respondToInvite).mockResolvedValue({ id: GID, name: "Family", member: true });
    render(<GroupRoute />);
    expect(await screen.findByText("Bea Arthur invited you to Family")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join group" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Family" })).toBeTruthy();
    expect(respondToInvite).toHaveBeenCalledWith(GID, true);
  });

  it("says so when you're not in the group", async () => {
    vi.mocked(getGroupDetails).mockResolvedValue([]);
    render(<GroupRoute />);
    expect(await screen.findByText("You're not in this group")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Your groups" }).getAttribute("href")).toMatch(/^\/profile\/?\?sheet=groups$/);
  });

  it("offers a retry when the groups fail to load", async () => {
    vi.mocked(getGroupDetails).mockRejectedValue(new Error("boom"));
    render(<GroupRoute />);
    expect(await screen.findByText("Could not load the group: boom")).toBeTruthy();
  });
});
