import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@armchair/app-core/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/social")>()),
  getFriends: vi.fn(),
  mySub: vi.fn(),
}));
vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import type { Group } from "@armchair/app-core/api/groups";
import { getMyGroups } from "@armchair/app-core/api/groups";
import { getSeason, type Season } from "@/lib/api/show";
import { getFriends, mySub, type Friends, type Person } from "@armchair/app-core/api/social";
import { DiscoverScreen, suggestions } from "./discover-screen";

const person = (sub: string, name: string): Person => ({ sub, name, picture: null, avatarKind: "initials" });
const ME = person("me", "Ada Lovelace");
const SAM = person("sam", "Sam Rivera");
const PRIYA = person("priya", "Priya Shah");
const BLOCKED = person("bad", "Blocked Person");

const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [],
  judges: [{ id: "derek-hough", name: "Derek Hough", headshot: null }],
  contestants: [
    {
      id: "tyler-cameron",
      keyword: "TYLER",
      members: [
        { name: "Tyler Cameron", role: "celebrity", headshot: null },
        { name: "Witney Carson", role: "pro", headshot: null },
      ],
    },
    { id: "amber-glenn", keyword: "AMBER", members: [{ name: "Amber Glenn", role: "celebrity", headshot: null }] },
  ],
};
const FRIENDS: Friends = {
  inviteCode: "x",
  friends: [{ ...SAM, at: null }],
  incoming: [],
  outgoing: [],
  blocked: [{ ...BLOCKED, at: null }],
};
const GROUPS: Group[] = [
  { id: "g1", name: "Family", inviteCode: "f", members: [ME, SAM, PRIYA, BLOCKED] },
  { id: "g2", name: "Work", inviteCode: "w", members: [ME, PRIYA] },
];

beforeEach(() => {
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getFriends).mockResolvedValue(FRIENDS);
  vi.mocked(getMyGroups).mockResolvedValue(GROUPS);
  vi.mocked(mySub).mockResolvedValue("me");
});
afterEach(() => vi.clearAllMocks());

const href = (el: HTMLElement) => el.getAttribute("href")?.replace(/\/(?=\?|$)/, "");

describe("suggestions", () => {
  it("is group-mates who aren't you, a friend or blocked, once each with the first shared group", () => {
    expect(suggestions({ me: "me", friends: FRIENDS, groups: GROUPS })).toEqual([{ person: PRIYA, group: "Family" }]);
  });
});

describe("DiscoverScreen", () => {
  it("lists the season's stars and judges, linked to their pages", async () => {
    render(<DiscoverScreen />);
    const stars = await screen.findByRole("region", { name: "Stars of Season 35" });
    const tyler = within(stars).getAllByRole("listitem")[1];
    const links = within(tyler).getAllByRole("link");
    expect(links.map((a) => [a.getAttribute("aria-label") ?? a.textContent, href(a)])).toEqual([
      ["Tyler Cameron & Witney Carson, couple page", "/couples/couple?id=tyler-cameron&season=dwts-35"],
      ["Tyler Cameron", "/people?id=tyler-cameron"],
      ["Witney Carson", "/people?id=witney-carson"],
    ]);
    const judges = screen.getByRole("region", { name: "Judges" });
    expect(href(within(judges).getByRole("link"))).toBe("/people?id=derek-hough");
  });

  it("lists friends and group-mates, linked to their profiles", async () => {
    render(<DiscoverScreen />);
    const friends = await screen.findByRole("region", { name: "Your friends" });
    expect(href(within(friends).getByRole("link", { name: /Sam Rivera/ }))).toBe("/profile?u=sam");
    const suggested = screen.getByRole("region", { name: "From your groups" });
    expect(within(suggested).getByRole("link").textContent).toContain("In Family");
  });

  it("points someone with no friends at the friends page", async () => {
    vi.mocked(getFriends).mockResolvedValue({ ...FRIENDS, friends: [] });
    vi.mocked(getMyGroups).mockResolvedValue([]);
    render(<DiscoverScreen />);
    const friends = await screen.findByRole("region", { name: "Your friends" });
    expect(href(within(friends).getByRole("link", { name: "Find friends" }))).toBe("/profile?sheet=friends");
    expect(screen.queryByRole("region", { name: "From your groups" })).toBeNull();
  });

  it("shows a failed load with a retry", async () => {
    vi.mocked(getFriends).mockRejectedValue(new Error("Network down"));
    render(<DiscoverScreen />);
    expect((await screen.findByRole("alert")).textContent).toContain("Network down");
  });
});
