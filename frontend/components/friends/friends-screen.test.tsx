import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.replace }),
  useSearchParams: () => nav.params,
}));
vi.mock("@/components/signed-in", () => ({
  SignedIn: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getFriends: vi.fn(),
  searchPeople: vi.fn(),
  addFriend: vi.fn(),
  acceptFriend: vi.fn(),
  removeFriend: vi.fn(),
  setBlocked: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  mySub: vi.fn(),
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
import {
  acceptFriend,
  addFriend,
  getFriends,
  getNotifications,
  mySub,
  removeFriend,
  searchPeople,
  setBlocked,
  type Friends,
} from "@/lib/api/social";
import { resetNotifications } from "@/lib/social/notifications";
import { FriendsScreen } from "./friends-screen";

const person = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const });
const contact = (sub: string, name: string) => ({ ...person(sub, name), at: "2026-09-30T12:00:00+00:00" });
const ME = "me";
const FRIENDS: Friends = {
  inviteCode: "k".repeat(16),
  friends: [contact("b", "Bea Arthur"), contact("c", "Carol Burnett")],
  incoming: [contact("d", "Dan Levy")],
  outgoing: [],
  blocked: [contact("x", "Xavier Blocked")],
};
const GID = "g".repeat(12);
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

function at(query: string) {
  nav.params = new URLSearchParams(query);
}

beforeEach(() => {
  resetNotifications();
  at("");
  vi.mocked(getFriends).mockResolvedValue(FRIENDS);
  vi.mocked(getNotifications).mockResolvedValue({ items: [], unread: 0, next: null });
  vi.mocked(getGroupDetails).mockResolvedValue([group()]);
  vi.mocked(mySub).mockResolvedValue(ME);
  for (const fn of [acceptFriend, removeFriend, setBlocked, inviteToGroup, manageGroup, leaveGroup, deleteGroup, respondToInvite]) {
    vi.mocked(fn).mockResolvedValue({} as never);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Friends tab", () => {
  it("lists friends and the invite link, and counts waiting requests on the tab", async () => {
    render(<FriendsScreen />);
    expect(await screen.findByText("Bea Arthur")).toBeTruthy();
    expect(screen.getByText("Carol Burnett")).toBeTruthy();
    expect((screen.getByLabelText("Or send your invite link") as HTMLInputElement).value).toMatch(
      /\/friends\/\?add=k{16}$/,
    );
    expect(screen.getByRole("tab", { name: "Requests, 1 waiting" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Friends" }).getAttribute("aria-selected")).toBe("true");
  });

  it("finds people by name and sends a request", async () => {
    vi.mocked(searchPeople).mockResolvedValue([{ ...person("z", "Zoe Ball"), status: null }]);
    vi.mocked(addFriend).mockResolvedValue({ status: "outgoing", user: person("z", "Zoe Ball") });
    render(<FriendsScreen />);
    const box = await screen.findByLabelText("Find people by name");

    fireEvent.change(box, { target: { value: "z" } });
    fireEvent.change(box, { target: { value: "zo" } });
    const results = await screen.findByRole("list", { name: "Search results" });
    expect(searchPeople).toHaveBeenCalledTimes(1);
    expect(searchPeople).toHaveBeenCalledWith("zo");

    fireEvent.click(within(results).getByRole("button", { name: "Add friend" }));
    expect(await within(results).findByText("Requested")).toBeTruthy();
    expect(addFriend).toHaveBeenCalledWith({ sub: "z" });
  });

  it("asks before unfriending", async () => {
    render(<FriendsScreen />);
    const row = (await screen.findByText("Bea Arthur")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    expect(removeFriend).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Unfriend" }));
    await vi.waitFor(() => expect(removeFriend).toHaveBeenCalledWith("b"));
    await vi.waitFor(() => expect(getFriends).toHaveBeenCalledTimes(2));
  });

  it("sends a request from an invite link and tidies the URL", async () => {
    at("add=" + "q".repeat(16));
    vi.mocked(addFriend).mockResolvedValue({ status: "outgoing", user: person("q", "Quinn Fabray") });
    render(<FriendsScreen />);
    expect((await screen.findByRole("status")).textContent).toBe("Friend request sent to Quinn Fabray.");
    expect(addFriend).toHaveBeenCalledWith({ code: "q".repeat(16) });
    expect(nav.replace).toHaveBeenCalledWith("/friends/", { scroll: false });
  });

  it("says so when an invite link is bad", async () => {
    at("add=" + "q".repeat(16));
    vi.mocked(addFriend).mockRejectedValue(new Error("That invite link doesn't match anyone"));
    render(<FriendsScreen />);
    expect((await screen.findByRole("alert")).textContent).toContain("doesn't match anyone");
  });
});

describe("Requests tab", () => {
  it("accepts a friend request, joins a group invite, and unblocks", async () => {
    at("tab=requests");
    vi.mocked(getNotifications).mockResolvedValue({
      items: [
        {
          id: "2026-09-30T12:00:00+00:00#abcdefgh",
          type: "group_invite",
          read: false,
          state: "pending",
          at: "2026-09-30T12:00:00+00:00",
          from: person("b", "Bea Arthur"),
          group: { id: GID, name: "Family" },
        },
      ],
      unread: 1,
      next: null,
    });
    render(<FriendsScreen />);

    const dan = (await screen.findByText("Dan Levy")).closest("li")!;
    fireEvent.click(within(dan).getByRole("button", { name: "Accept" }));
    await vi.waitFor(() => expect(acceptFriend).toHaveBeenCalledWith("d"));

    const invite = (await screen.findByText("Invited you to Family")).closest("li")!;
    fireEvent.click(within(invite).getByRole("button", { name: "Join" }));
    await vi.waitFor(() => expect(respondToInvite).toHaveBeenCalledWith(GID, true));

    const blocked = screen.getByText("Xavier Blocked").closest("li")!;
    fireEvent.click(within(blocked).getByRole("button", { name: "Unblock" }));
    await vi.waitFor(() => expect(setBlocked).toHaveBeenCalledWith("x", false));
  });

  it("has an empty state", async () => {
    at("tab=requests");
    vi.mocked(getFriends).mockResolvedValue({ ...FRIENDS, incoming: [], blocked: [] });
    render(<FriendsScreen />);
    expect(await screen.findByText("No requests right now.")).toBeTruthy();
  });
});

describe("Groups tab", () => {
  it("lists groups and opens one", async () => {
    at("tab=groups");
    render(<FriendsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Family.*2 members.*1 waiting/ }));
    expect(nav.replace).toHaveBeenCalledWith(`/friends/?tab=groups&group=${GID}`, { scroll: false });
  });

  it("keeps the list beside an open group and marks the one that's open", async () => {
    at(`tab=groups&group=${GID}`);
    render(<FriendsScreen />);
    await screen.findByRole("article", { name: "Family" });
    expect(screen.getByRole("button", { name: /Family.*2 members/ }).getAttribute("aria-current")).toBe("true");
  });

  it("gives the owner the controls: requests, removal, invites, delete", async () => {
    at(`tab=groups&group=${GID}`);
    render(<FriendsScreen />);
    const detail = await screen.findByRole("article", { name: "Family" });

    const eve = within(detail).getByText("Eve Arden").closest("li")!;
    fireEvent.click(within(eve).getByRole("button", { name: "Let in" }));
    await vi.waitFor(() => expect(manageGroup).toHaveBeenCalledWith(GID, { action: "approve", sub: "e" }));

    // Carol is a friend who isn't in yet; Bea is a member already.
    const carol = within(detail).getByText("Carol Burnett").closest("li")!;
    fireEvent.click(within(carol).getByRole("button", { name: "Invite" }));
    await vi.waitFor(() => expect(inviteToGroup).toHaveBeenCalledWith(GID, "c"));

    const bea = within(detail).getAllByText("Bea Arthur")[0].closest("li")!;
    expect(within(bea).getByRole("button", { name: "Remove" })).toBeTruthy();
    const me = within(detail).getByText("Me Myself").closest("li")!;
    expect(within(me).queryByRole("button")).toBeNull();

    fireEvent.click(within(detail).getByRole("button", { name: "Delete group" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Delete for everyone" }));
    await vi.waitFor(() => expect(deleteGroup).toHaveBeenCalledWith(GID));
  });

  it("gives a member only Leave", async () => {
    vi.mocked(getGroupDetails).mockResolvedValue([group({ owner: "b", requests: [] })]);
    at(`tab=groups&group=${GID}`);
    render(<FriendsScreen />);
    const detail = await screen.findByRole("article", { name: "Family" });

    expect(within(detail).queryByRole("button", { name: "Rename" })).toBeNull();
    expect(within(detail).queryByRole("button", { name: "Remove" })).toBeNull();
    expect(within(detail).queryByRole("checkbox")).toBeNull();
    fireEvent.click(within(detail).getByRole("button", { name: "Leave group" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Leave" }));
    await vi.waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(GID));
  });
});
