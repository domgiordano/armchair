import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { nav } = vi.hoisted(() => ({ nav: { search: new URLSearchParams(), replace: vi.fn(), push: vi.fn() } }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/social/",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => nav.search,
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@armchair/app-core/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/social")>()),
  getFriends: vi.fn(),
  acceptFriend: vi.fn(),
  removeFriend: vi.fn(),
  mySub: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));
vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
  getGroupDetails: vi.fn(),
}));

vi.mock("@/lib/api/leaderboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/leaderboard")>()),
  getLeaderboard: vi.fn(),
}));

import { getGroupDetails, getMyGroups } from "@armchair/app-core/api/groups";
import { getLeaderboard } from "@/lib/api/leaderboard";
import { acceptFriend, getFriends, getNotifications, mySub, removeFriend } from "@armchair/app-core/api/social";
import { resetNotifications } from "@armchair/app-core/social/notifications";
import { SocialScreen } from "./social-screen";

const CARA = { sub: "c", name: "Cara", picture: null, avatarKind: "initials" as const, at: null };

beforeEach(() => {
  nav.search = new URLSearchParams();
  vi.mocked(getFriends).mockResolvedValue({ inviteCode: "x", friends: [CARA], incoming: [], outgoing: [], blocked: [] });
  vi.mocked(getMyGroups).mockResolvedValue([]);
  vi.mocked(getGroupDetails).mockResolvedValue([
    {
      id: "g1",
      name: "Family",
      inviteCode: "i",
      owner: "me",
      approval: false,
      members: [{ sub: "me", name: "Test Viewer", picture: null, avatarKind: "initials", relation: null }],
      invited: [],
      requests: [],
    },
  ]);
  vi.mocked(mySub).mockResolvedValue("me");
  const viewer = { sub: "me", name: "Test Viewer", picture: null, avatarKind: "initials" as const, count: 9, closestJudge: null };
  vi.mocked(getLeaderboard).mockResolvedValue({
    season: "dwts-35",
    scope: "group",
    group: "g1",
    minDances: 5,
    ranked: [{ ...viewer, rank: 1, mae: 1.1 }],
    unranked: [],
    me: { ...viewer, rank: 1, mae: 1.1 },
    week: { ep: 6, week: 5, rateable: 11, answered: { me: 11 } },
  });
  vi.mocked(getNotifications).mockResolvedValue({ items: [], unread: 0, next: null });
  resetNotifications();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SocialScreen", () => {
  it("opens on your friends, and switches lists through ?view=", async () => {
    render(<SocialScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Friends & Groups" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Cara" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Friends", selected: true })).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Friends", "Groups", "Requests"]);

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(nav.replace).toHaveBeenCalledWith("/social/?view=groups", { scroll: false });
  });

  it("shows each group as a card with your place, the leader and this week", async () => {
    nav.search = new URLSearchParams({ view: "groups" });
    render(<SocialScreen />);
    const family = await screen.findByRole("link", { name: /Family/ });
    expect(family.getAttribute("href")).toMatch(/^\/groups\/?\?id=g1$/);
    expect(await within(family).findByText("#1")).toBeTruthy();
    expect(within(family).getByText("Test Viewer", { selector: "dd" })).toBeTruthy();
    expect(within(family).getByText(/of 1 scored week 5/)).toBeTruthy();
    expect(within(family).getByText(/Dancing with the Stars/)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Group name" })).toBeTruthy();
  });

  it("joins from a pasted group link, and says when it isn't one", async () => {
    nav.search = new URLSearchParams({ view: "groups" });
    render(<SocialScreen />);
    const box = await screen.findByRole("textbox", { name: "Group link or code" });
    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText(/doesn't look like a group link/)).toBeTruthy();
    fireEvent.change(box, { target: { value: "https://api.test/invite/preview?code=AbCdEfGh_jKl-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(nav.push).toHaveBeenCalledWith("/join/?code=AbCdEfGh_jKl-123");
  });

  it("filters friends and unfriends in place", async () => {
    vi.mocked(removeFriend).mockResolvedValue({ status: null });
    render(<SocialScreen />);
    const box = await screen.findByRole("searchbox", { name: /Search friends/ });
    fireEvent.change(box, { target: { value: "zz" } });
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    fireEvent.change(box, { target: { value: "car" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Unfriend" }));
    await vi.waitFor(() => expect(removeFriend).toHaveBeenCalledWith("c"));
  });

  it("focuses the search with ?find=1", async () => {
    nav.search = new URLSearchParams({ view: "friends", find: "1" });
    render(<SocialScreen />);
    const box = await screen.findByRole("searchbox", { name: /Search friends/ });
    expect(document.activeElement).toBe(box);
  });

  it("counts waiting requests on the tab and answers them", async () => {
    nav.search = new URLSearchParams({ view: "requests" });
    vi.mocked(getFriends).mockResolvedValue({
      inviteCode: "x",
      friends: [],
      incoming: [{ sub: "d", name: "Dan Levy", picture: null, avatarKind: "initials", at: null }],
      outgoing: [],
      blocked: [],
    });
    vi.mocked(acceptFriend).mockResolvedValue({ status: "friend" });
    render(<SocialScreen />);
    expect(await screen.findByRole("tab", { name: "Requests, 1 waiting", selected: true })).toBeTruthy();
    const requests = screen.getByRole("tabpanel");
    fireEvent.click(await within(requests).findByRole("button", { name: "Accept" }));
    await vi.waitFor(() => expect(acceptFriend).toHaveBeenCalledWith("d"));
  });
});
