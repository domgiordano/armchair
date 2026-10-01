import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  acceptFriend: vi.fn(),
  removeFriend: vi.fn(),
}));
vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  respondToInvite: vi.fn(),
  manageGroup: vi.fn(),
}));

import { manageGroup, respondToInvite } from "@/lib/api/groups";
import {
  acceptFriend,
  getNotifications,
  markNotificationsRead,
  removeFriend,
  type Notification,
} from "@/lib/api/social";
import { resetNotifications } from "@/lib/social/notifications";
import { NotificationList, NotificationsBell, timeAgo } from "./notifications";

const person = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const });
const note = (over: Partial<Notification>): Notification => ({
  id: `2026-09-30T12:00:00+00:00#${Math.random().toString(36).slice(2, 10)}`,
  type: "friend_accepted",
  read: false,
  state: null,
  at: new Date(Date.now() - 5 * 60_000).toISOString(),
  from: person("b", "Bea Arthur"),
  group: null,
  ...over,
});

const FRIEND = note({ type: "friend_request", state: "pending" });
const INVITE = note({
  type: "group_invite",
  state: "pending",
  from: person("c", "Carol Burnett"),
  group: { id: "g".repeat(12), name: "Family" },
});
const JOIN = note({
  type: "group_join_request",
  state: "pending",
  from: person("d", "Dan Levy"),
  group: { id: "h".repeat(12), name: "Work" },
});
const DONE = note({ type: "friend_accepted", read: true, from: person("e", "Eve Arden") });

function serve(items: Notification[]) {
  vi.mocked(getNotifications).mockResolvedValue({
    items,
    unread: items.filter((n) => !n.read).length,
    next: null,
  });
}

beforeEach(() => {
  resetNotifications();
  vi.mocked(markNotificationsRead).mockResolvedValue(undefined);
  for (const fn of [acceptFriend, removeFriend, respondToInvite, manageGroup]) {
    vi.mocked(fn).mockResolvedValue({} as never);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

const card = (name: RegExp) => screen.getByRole("article", { name });

describe("NotificationList", () => {
  it("says who did what, and marks everything read once shown", async () => {
    serve([FRIEND, INVITE, DONE]);
    render(<NotificationList />);

    expect(await screen.findByRole("article", { name: "Bea Arthur wants to be friends" })).toBeTruthy();
    expect(card(/Carol Burnett invited you to Family/)).toBeTruthy();
    expect(card(/Eve Arden accepted your friend request/)).toBeTruthy();
    expect(within(card(/Bea Arthur/)).getByText("5m ago")).toBeTruthy();
    expect(within(card(/Bea Arthur/)).getByRole("link", { name: "Bea Arthur" }).getAttribute("href")).toMatch(/^\/profile\/?\?u=/);
    await vi.waitFor(() => expect(markNotificationsRead).toHaveBeenCalledWith(undefined));
    // Still highlighted as new for this viewing.
    expect(within(card(/Bea Arthur/)).getByText(", new")).toBeTruthy();
    expect(within(card(/Eve Arden/)).queryByText(", new")).toBeNull();
    // Only requests and invites carry actions.
    expect(within(card(/Eve Arden/)).queryByRole("button")).toBeNull();
  });

  it("accepts a friend request in place", async () => {
    serve([FRIEND]);
    render(<NotificationList />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    serve([{ ...FRIEND, state: "accepted", read: true }]);

    expect(await screen.findByText("Accepted")).toBeTruthy();
    expect(acceptFriend).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("routes each answer to its endpoint", async () => {
    serve([FRIEND, INVITE, JOIN]);
    render(<NotificationList />);
    await screen.findByRole("article", { name: /Bea Arthur/ });

    fireEvent.click(within(card(/Bea Arthur/)).getByRole("button", { name: "Decline" }));
    fireEvent.click(within(card(/Carol Burnett/)).getByRole("button", { name: "Decline" }));
    fireEvent.click(within(card(/Dan Levy asked to join Work/)).getByRole("button", { name: "Accept" }));

    await vi.waitFor(() => expect(manageGroup).toHaveBeenCalled());
    expect(removeFriend).toHaveBeenCalledWith("b");
    expect(respondToInvite).toHaveBeenCalledWith("g".repeat(12), false);
    expect(manageGroup).toHaveBeenCalledWith("h".repeat(12), { action: "approve", sub: "d" });
  });

  it("keeps the buttons and shows why when an answer fails", async () => {
    serve([INVITE]);
    vi.mocked(respondToInvite).mockRejectedValue(new Error("That invite has been withdrawn"));
    render(<NotificationList />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

    expect((await screen.findByRole("alert")).textContent).toBe("That invite has been withdrawn");
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });

  it("has an empty state", async () => {
    serve([]);
    render(<NotificationList />);
    expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(getNotifications).mockRejectedValueOnce(new Error("offline"));
    render(<NotificationList />);
    expect((await screen.findByRole("alert")).textContent).toContain("offline");

    serve([DONE]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: /Eve Arden/ })).toBeTruthy();
  });
});

describe("NotificationsBell", () => {
  it("counts unread and opens a panel on desktop", async () => {
    serve([FRIEND, INVITE, DONE]);
    render(<NotificationsBell />);

    const [link, button] = await screen.findAllByLabelText("Notifications, 2 unread");
    expect(link.getAttribute("href")).toMatch(/^\/notifications\/?$/);
    expect(screen.queryByRole("region")).toBeNull();

    fireEvent.click(button);
    const panel = screen.getByRole("region", { name: "Notifications" });
    expect(await within(panel).findByRole("article", { name: /Bea Arthur/ })).toBeTruthy();
    // Opening it reads them, so the badge clears.
    await vi.waitFor(() => expect(button.getAttribute("aria-label")).toBe("Notifications"));

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  it.each([
    ["2026-09-30T11:59:30Z", "just now"],
    ["2026-09-30T11:15:00Z", "45m ago"],
    ["2026-09-30T07:00:00Z", "5h ago"],
    ["2026-09-27T12:00:00Z", "3d ago"],
  ])("%s is %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});
