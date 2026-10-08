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
  addFriend: vi.fn(),
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
import { getLeaderboard, type Leaderboard } from "@/lib/api/leaderboard";
import {
  acceptFriend,
  addFriend,
  getFriends,
  getNotifications,
  mySub,
  removeFriend,
} from "@armchair/app-core/api/social";
import { resetNotifications } from "@armchair/app-core/social/notifications";
import { SocialScreen } from "./social-screen";

const CARA = { sub: "c", name: "Cara", picture: null, avatarKind: "initials" as const, at: null };
const DAN = { sub: "d", name: "Dan Levy", picture: null, avatarKind: "initials" as const };

beforeEach(() => {
  nav.search = new URLSearchParams();
  vi.mocked(getFriends).mockResolvedValue({
    inviteCode: "x",
    friends: [CARA],
    incoming: [],
    outgoing: [],
    blocked: [],
  });
  vi.mocked(getMyGroups).mockResolvedValue([]);
  vi.mocked(getGroupDetails).mockResolvedValue([
    {
      id: "g1",
      name: "Family",
      inviteCode: "i",
      owner: "me",
      approval: false,
      members: [
        { sub: "me", name: "Test Viewer", picture: null, avatarKind: "initials", relation: null },
        { ...CARA, relation: "friend" },
        { ...DAN, relation: null },
      ],
      invited: [],
      requests: [],
    },
  ]);
  vi.mocked(mySub).mockResolvedValue("me");
  const viewer = {
    sub: "me",
    name: "Test Viewer",
    picture: null,
    avatarKind: "initials" as const,
    count: 9,
    closestJudge: null,
  };
  const GROUP_BOARD: Leaderboard = {
    season: "dwts-35",
    scope: "group",
    group: "g1",
    minDances: 5,
    ranked: [{ ...viewer, rank: 1, mae: 1.1 }],
    unranked: [],
    me: { ...viewer, rank: 1, mae: 1.1 },
    week: { ep: 6, week: 5, rateable: 11, answered: { me: 11 } },
  };
  vi.mocked(getLeaderboard).mockImplementation(async (_season, scope) =>
    scope === "friends"
      ? {
          season: "dwts-35",
          scope: "friends",
          group: null,
          minDances: 5,
          ranked: [
            { ...viewer, rank: 1, mae: 1.1 },
            { ...CARA, count: 12, closestJudge: null, rank: 2, mae: 1.4 },
          ],
          unranked: [],
          me: { ...viewer, rank: 1, mae: 1.1 },
        }
      : GROUP_BOARD,
  );
  vi.mocked(getNotifications).mockResolvedValue({ items: [], unread: 0, next: null });
  resetNotifications();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SocialScreen", () => {
  it("opens on your friends as cards, and switches tabs through ?view=", async () => {
    render(<SocialScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Friends & Groups" })).toBeTruthy();
    const cara = await screen.findByRole("article", { name: "Cara" });
    expect(within(cara).getByRole("link", { name: /Cara/ }).getAttribute("href")).toMatch(/^\/profile\/?\?u=c$/);
    expect(await within(cara).findByText("#2")).toBeTruthy();
    expect(within(cara).getByText("0.30 further off than you")).toBeTruthy();
    expect(within(cara).getByText("In Family")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Friends", "Groups"]);

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(nav.replace).toHaveBeenCalledWith("/social/?view=groups", { scroll: false });
  });

  it("suggests people from your groups who aren't friends yet", async () => {
    vi.mocked(addFriend).mockResolvedValue({ status: "outgoing", user: DAN });
    render(<SocialScreen />);
    const suggested = await screen.findByRole("region", { name: /People from your groups/ });
    fireEvent.click(within(suggested).getByRole("button", { name: "Add" }));
    await vi.waitFor(() => expect(addFriend).toHaveBeenCalledWith({ sub: "d" }));
  });

  it("shows each group as a card with your place, the leader and this week", async () => {
    nav.search = new URLSearchParams({ view: "groups" });
    render(<SocialScreen />);
    const family = await screen.findByRole("link", { name: /Family/ });
    expect(family.getAttribute("href")).toMatch(/^\/groups\/?\?id=g1$/);
    expect(await within(family).findByText("#1")).toBeTruthy();
    expect(within(family).getByText("Test Viewer", { selector: "dd" })).toBeTruthy();
    expect(within(family).getByText(/of 3 scored week 5/)).toBeTruthy();
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

  it("filters friends and unfriends from the card's menu", async () => {
    vi.mocked(removeFriend).mockResolvedValue({ status: null });
    render(<SocialScreen />);
    const box = await screen.findByRole("searchbox", { name: /Search friends/ });
    fireEvent.change(box, { target: { value: "zz" } });
    expect(screen.queryByRole("article", { name: "Cara" })).toBeNull();
    fireEvent.change(box, { target: { value: "car" } });
    fireEvent.click(within(screen.getByRole("article", { name: "Cara" })).getByRole("button", { name: "Friends" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove friend" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Remove Cara?" })).getByRole("button", { name: "Remove friend" }),
    );
    await vi.waitFor(() => expect(removeFriend).toHaveBeenCalledWith("c"));
  });

  it("focuses the search with ?find=1", async () => {
    nav.search = new URLSearchParams({ view: "friends", find: "1" });
    render(<SocialScreen />);
    const box = await screen.findByRole("searchbox", { name: /Search friends/ });
    expect(document.activeElement).toBe(box);
  });

  it("puts friend requests on the Friends tab, counted, and answers them", async () => {
    nav.search = new URLSearchParams({ view: "requests" });
    vi.mocked(getFriends).mockResolvedValue({
      inviteCode: "x",
      friends: [],
      incoming: [{ ...DAN, at: null }],
      outgoing: [],
      blocked: [],
    });
    vi.mocked(acceptFriend).mockResolvedValue({ status: "friend" });
    render(<SocialScreen />);
    expect(await screen.findByRole("tab", { name: "Friends, 1 waiting", selected: true })).toBeTruthy();
    const card = await screen.findByRole("article", { name: "Friend request from Dan Levy" });
    fireEvent.click(within(card).getByRole("button", { name: "Accept" }));
    await vi.waitFor(() => expect(acceptFriend).toHaveBeenCalledWith("d"));
  });
});
