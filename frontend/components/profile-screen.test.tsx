import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { search, replace } = vi.hoisted(() => ({ search: { value: new URLSearchParams() }, replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/",
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => search.value,
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getSeason: vi.fn(),
}));
vi.mock("@/lib/api/profile", () => ({
  getMyProfile: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));
vi.mock("@/lib/api/couples", () => ({ getFavorites: vi.fn() }));
vi.mock("@armchair/app-core/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/social")>()),
  getFriends: vi.fn(),
  addFriend: vi.fn(),
  acceptFriend: vi.fn(),
  removeFriend: vi.fn(),
  setBlocked: vi.fn(),
  mySub: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));
vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
  getGroupDetails: vi.fn(),
}));

import { ApiError } from "@armchair/app-core/api/client";
import { getFavorites, type CoupleSummary, type Performers } from "@/lib/api/couples";
import { getGroupDetails, getMyGroups } from "@armchair/app-core/api/groups";
import { getMyProfile, getProfile, updateProfile, uploadAvatar, type Detail, type MyProfile, type Profile } from "@/lib/api/profile";
import { getSeason, type Member, type Season } from "@/lib/api/show";
import { acceptFriend, addFriend, getFriends, getNotifications, mySub, removeFriend } from "@armchair/app-core/api/social";
import { resetNotifications } from "@armchair/app-core/social/notifications";
import { choose } from "./ui/select-test-utils";
import { ProfileScreen } from "./profile-screen";

const SEASON: Season = {
  season: "dwts-35",
  open: false,
  timezone: "America/New_York",
  episodes: [
    { ep: 3, week: 2, airDate: "2026-09-22", start: "20:00", end: "22:00", theme: null },
    { ep: 4, week: 3, airDate: "2026-09-29", start: "20:00", end: "22:00", theme: null },
  ],
  judges: [
    { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
    { id: "derek-hough", name: "Derek Hough", headshot: null },
  ],
  contestants: [
    {
      id: "tyler-cameron",
      keyword: "TYLER",
      members: [
        { name: "Tyler Cameron", role: "celebrity", headshot: null },
        { name: "Pro One", role: "pro", headshot: null },
      ],
    },
    {
      id: "amber-glenn",
      keyword: "AMBER",
      members: [{ name: "Amber Glenn", role: "celebrity", headshot: null }],
    },
  ],
};

const ME: MyProfile = {
  sub: "me",
  email: "viewer@example.com",
  name: "Test Viewer",
  picture: "https://lh3.googleusercontent.com/a/photo",
  avatarKind: "google",
  createdAt: "2026-09-10T00:00:00+00:00",
  lastSeenAt: "2026-09-30T00:00:00+00:00",
  customName: null,
  googleName: "Test Viewer",
  googlePicture: "https://lh3.googleusercontent.com/a/photo",
  uploadPicture: null,
};

const TYLER: Member[] = [
  { name: "Tyler Cameron", role: "celebrity", headshot: null },
  { name: "Pro One", role: "pro", headshot: null },
];
const AMBER: Member[] = [{ name: "Amber Glenn", role: "celebrity", headshot: null }];

const DETAIL: Detail = {
  count: 3,
  mae: 1.33,
  judges: {
    "carrie-ann-inaba": { count: 3, mae: 1.5 },
    "derek-hough": { count: 3, mae: 0.5 },
  },
  gap: 0.33,
  styles: [
    { style: "Rumba", count: 1, mae: 0, paddle: 8, judges: 8 },
    { style: "Tango", count: 2, mae: 2, paddle: 7.5, judges: 7.5 },
  ],
  weeks: [
    { season: "dwts-35", ep: 3, week: 2, count: 1, mae: 2, paddle: 6, judges: 8 },
    { season: "dwts-35", ep: 4, week: 3, count: 2, mae: 1, paddle: 8.5, judges: 7.5 },
  ],
  distribution: Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    you: [6, 8, 9].filter((p) => p === i + 1).length,
    judges: [8, 8, 7].filter((p) => p === i + 1).length,
  })),
  best: { season: "dwts-35", ep: 4, week: 3, key: "amber-glenn#1", style: "Rumba", members: AMBER, paddle: 8, panelMean: 8, error: 0 },
  worst: { season: "dwts-35", ep: 3, week: 2, key: "tyler-cameron#1", style: "Tango", members: TYLER, paddle: 6, panelMean: 8, error: 2 },
};

const EMPTY: Detail = { count: 0, mae: null, judges: {}, gap: null, styles: [], weeks: [], distribution: [], best: null, worst: null };

const MINE: Profile = {
  sub: "me",
  name: "Test Viewer",
  picture: ME.picture,
  avatarKind: "google",
  memberSince: ME.createdAt,
  groupCount: 2,
  friendCount: 3,
  season: {
    season: "dwts-35",
    count: 3,
    mae: 1.33,
    judges: DETAIL.judges,
    rank: 2,
    ranked: 14,
  },
  allTime: { count: 3, mae: 1.33, closestJudge: { id: "derek-hough", mae: 0.5 }, rank: 4, ranked: 30 },
  recent: [],
  detail: DETAIL,
  history: [
    { season: "dwts-35", count: 3, mae: 1.33, rank: 2, ranked: 14 },
    { season: "dwts-34", count: 40, mae: 1.1, rank: 1, ranked: 9 },
  ],
};

const THEIRS: Profile = {
  sub: "b",
  name: "Dance Mom",
  picture: null,
  avatarKind: "initials",
  memberSince: "2026-09-12T00:00:00+00:00",
  friendCount: 1,
  season: { season: "dwts-35", count: 3, mae: null, judges: {}, rank: null, ranked: 14 },
  allTime: { count: 3, mae: null, closestJudge: null, rank: null, ranked: 30 },
  recent: [],
  detail: { ...DETAIL, count: 2 },
  history: [{ season: "dwts-35", count: 3, mae: null, rank: null, ranked: 14 }],
  mutual: {
    friends: [{ sub: "c", name: "Cara", picture: null, avatarKind: "initials" }],
    groups: [{ id: "g1", name: "Family" }],
  },
};

const couple = (id: string, members: Member[], you: number, gap: number): CoupleSummary => ({
  ref: `dwts-35/${id}`,
  id,
  season: "dwts-35",
  members,
  dances: 2,
  you,
  judges: you - gap,
  judged: 2,
  gap,
  absGap: Math.abs(gap),
  friends: { mean: null, raters: 0 },
  everyone: { mean: null, raters: 0 },
  eliminated: null,
});

const FAVORITES: Performers<CoupleSummary> = {
  sub: "me",
  season: "dwts-35",
  group: null,
  couples: [couple("amber-glenn", AMBER, 9, 1.5), couple("tyler-cameron", TYLER, 7, -1)],
  pros: [{ name: "Pro One", headshot: null, seasons: ["dwts-35"], couples: 1, dances: 2, you: 7, judges: 8, judged: 2, gap: -1, absGap: 1 }],
  celebrities: [],
  styles: [{ style: "Rumba", dances: 1, you: 9, judges: 8, judged: 1, gap: 1, absGap: 1 }],
  favorites: ["dwts-35/amber-glenn", "dwts-35/tyler-cameron"],
  leastFavorites: [],
  softerOn: ["dwts-35/amber-glenn"],
  tougherOn: ["dwts-35/tyler-cameron"],
};

beforeEach(() => {
  search.value = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getMyProfile).mockResolvedValue(ME);
  vi.mocked(getProfile).mockImplementation(async (_season, sub) => (sub ? THEIRS : MINE));
  vi.mocked(getFavorites).mockResolvedValue(FAVORITES);
  vi.mocked(getFriends).mockResolvedValue({
    inviteCode: "x",
    friends: [{ sub: "c", name: "Cara", picture: null, avatarKind: "initials", at: null }],
    incoming: [],
    outgoing: [],
    blocked: [],
  });
  vi.mocked(getMyGroups).mockResolvedValue([{ id: "g1", name: "Family", inviteCode: "i", members: [] }]);
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
  vi.mocked(getNotifications).mockResolvedValue({ items: [], unread: 0, next: null });
  resetNotifications();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const openTab = async (name: string) => {
  fireEvent.click(await screen.findByRole("tab", { name }));
  return screen.getByRole("tabpanel");
};

describe("ProfileScreen, your own", () => {
  it("leads with who you are, your place and your people, and no sign-out button", async () => {
    render(<ProfileScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Test Viewer" })).toBeTruthy();
    expect(screen.getByText("Member since September 2026")).toBeTruthy();
    expect(getProfile).toHaveBeenCalledWith("dwts-35", null);

    const glance = screen.getByRole("list", { name: "At a glance" });
    expect(within(glance).getByRole("link", { name: "Rank #2 of 14, Season 35" }).textContent).toBe("#2of 14 · S35");
    // The count follows your friends list once it lands.
    expect(await within(glance).findByRole("link", { name: "1 friend" })).toBeTruthy();
    expect(within(glance).getByRole("link", { name: "2 groups" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Requests/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    const settings = screen.getByRole("region", { name: "Settings" });
    expect(settings.id).toBe("settings");
    expect(within(settings).getByRole("button", { name: "Delete account" })).toBeTruthy();

    const overview = screen.getByRole("tabpanel");
    const tiles = within(overview).getAllByRole("definition").map((d) => d.textContent);
    expect(tiles.slice(0, 4)).toEqual(["1.3 offaverage per dance", "3Season 35", "Derek Hough0.5 off", "#2of 14 ranked players"]);
  });

  it("charts accuracy per judge and style and names the best and worst calls", async () => {
    render(<ProfileScreen />);
    const panel = await openTab("Accuracy");
    const styles = within(panel).getByRole("region", { name: "By dance style" });
    expect(within(styles).getAllByRole("listitem").map((r) => r.textContent)).toEqual([
      "Rumba1 dance0 off",
      "Tango2 dances2 off",
    ]);
    const judges = within(panel).getByRole("region", { name: "Per judge" });
    expect(within(judges).getAllByRole("listitem")[0].textContent).toContain("Derek Hough");

    const calls = within(panel).getByRole("region", { name: "Best and worst calls" });
    const [best, worst] = within(calls).getAllByRole("listitem");
    expect(best.textContent).toContain("Amber Glenn");
    expect(best.textContent).toContain("Rumba · Week 3");
    expect(within(worst).getByRole("link", { name: "Tyler Cameron" }).getAttribute("href")).toMatch(/^\/people\/?\?id=tyler-cameron$/);
    expect(worst.textContent).toContain("Tango · Week 2");

    const table = within(panel).getByRole("table", { name: /Paddles you gave/ });
    expect(within(table).getByRole("row", { name: "8 1 2" })).toBeTruthy();
  });

  it("shows favorite couples, pros, over- and underrated couples and styles", async () => {
    render(<ProfileScreen />);
    const panel = await openTab("Favorites");
    expect(getFavorites).toHaveBeenCalledWith("dwts-35", null);
    const top = await within(panel).findByRole("region", { name: "Favorite couples" });
    expect(within(top).getAllByRole("listitem")[0].textContent).toContain("Amber Glenn");
    const pros = within(panel).getByRole("region", { name: "Favorite pros" });
    expect(within(pros).getByRole("link", { name: "Pro One" }).getAttribute("href")).toMatch(/^\/people\/?\?id=pro-one$/);
    expect(within(panel).getByRole("region", { name: "Most overrated" }).textContent).toContain("+1.5");
    expect(within(panel).getByRole("region", { name: "Most underrated" }).textContent).toContain("−1.0");
    expect(within(panel).getByRole("region", { name: "Favorite dance styles" }).textContent).toContain("Rumba");
  });

  it("switches the numbers to all-time", async () => {
    vi.mocked(getProfile).mockImplementation(async (season) =>
      season === "all" ? { ...MINE, season: { ...MINE.season, season: "all", count: 43 } } : MINE,
    );
    render(<ProfileScreen />);
    choose(await screen.findByRole("combobox", { name: "Seasons" }), "All-time");
    expect(await within(screen.getByRole("tabpanel")).findByText("43")).toBeTruthy();
    expect(getProfile).toHaveBeenCalledWith("all", null);
    fireEvent.click(screen.getByRole("tab", { name: "Favorites" }));
    expect(getFavorites).toHaveBeenCalledWith("all", null);
  });

  it("lists every season with its place", async () => {
    render(<ProfileScreen />);
    const panel = await openTab("History");
    const rows = within(panel).getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href")?.replace("/?", "?"))).toEqual([
      "/leaderboard?season=dwts-35",
      "/leaderboard?season=dwts-34",
    ]);
    expect(rows[1].textContent).toContain("Best");
    expect(rows[1].textContent).toContain("#1 of 9");
    expect(screen.queryByRole("combobox", { name: "Seasons" })).toBeNull();
  });

  it("links your counts to your lists on /social/", async () => {
    render(<ProfileScreen />);
    const glance = await screen.findByRole("list", { name: "At a glance" });
    expect((await within(glance).findByRole("link", { name: "1 friend" })).getAttribute("href")).toMatch(/^\/social\/?\?view=friends$/);
    expect(within(glance).getByRole("link", { name: "2 groups" }).getAttribute("href")).toMatch(/^\/social\/?\?view=groups$/);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a Requests pill that links to the requests list", async () => {
    vi.mocked(getFriends).mockResolvedValue({
      inviteCode: "x",
      friends: [],
      incoming: [{ sub: "d", name: "Dan Levy", picture: null, avatarKind: "initials", at: null }],
      outgoing: [],
      blocked: [],
    });
    render(<ProfileScreen />);
    const pill = await screen.findByRole("link", { name: "Requests, 1 waiting" });
    expect(pill.getAttribute("href")).toMatch(/^\/social\/?\?view=requests$/);
  });

  it("sends an old ?sheet= link on to /social/", async () => {
    search.value = new URLSearchParams({ sheet: "groups" });
    render(<ProfileScreen />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/social/?view=groups"));
  });

  it("saves a new display name and returns to the heading", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ...ME, name: "Dance Mom", customName: "Dance Mom" });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit display name" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    fireEvent.change(input, { target: { value: "  Dance Mom " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Dance Mom" })).toBeTruthy();
    expect(updateProfile).toHaveBeenCalledWith({ name: "Dance Mom" });
  });

  it("refuses a one-letter name without calling the API", async () => {
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit display name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Display name" }), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toBe("Use 2 to 40 characters.");
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("switches to initials from the camera badge's sheet", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ...ME, picture: null, avatarKind: "initials" });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Change photo" }));
    const editor = screen.getByRole("dialog", { name: "Profile photo" });
    expect(within(editor).getByRole("radio", { name: "Google photo" })).toHaveProperty("checked", true);
    expect(within(editor).queryByRole("radio", { name: "Your upload" })).toBeNull();
    await act(async () => {
      fireEvent.click(within(editor).getByRole("radio", { name: "Initials" }));
    });
    expect(updateProfile).toHaveBeenCalledWith({ avatar: "initials" });
    expect(await within(editor).findByText("Photo updated.")).toBeTruthy();
    expect(within(editor).getByRole("radio", { name: "Initials" })).toHaveProperty("checked", true);
  });

  it("crops a picked photo to a 512px JPEG and uploads it", async () => {
    vi.mocked(uploadAvatar).mockResolvedValue({ ...ME, avatarKind: "upload", uploadPicture: "https://cdn/a.jpg" });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done, type) =>
      done(new Blob(["jpeg"], { type: type ?? "" })),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // jsdom never decodes images, so load one by hand at 800x600.
    const loads: HTMLImageElement[] = [];
    vi.spyOn(window, "Image").mockImplementation(function () {
      const img = document.createElement("img");
      Object.defineProperties(img, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
      loads.push(img);
      return img;
    });

    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Change photo" }));
    fireEvent.change(screen.getByLabelText("Upload a new photo"), {
      target: { files: [new File(["x"], "me.heic", { type: "image/heic" })] },
    });
    await act(async () => loads[0].onload?.(new Event("load")));
    expect(screen.getByRole("group", { name: "Photo framing" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Use this photo" }));
    });
    // The centred 600px square of an 800x600 photo, scaled to 512.
    expect(drawImage).toHaveBeenCalledWith(loads[0], 100, 0, 600, 600, 0, 0, 512, 512);
    const photo = vi.mocked(uploadAvatar).mock.calls[0][0];
    expect(photo.type).toBe("image/jpeg");
    expect(await screen.findByText("Photo updated.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Your upload" })).toHaveProperty("checked", true);
  });

  it("turns away a file that isn't a photo", async () => {
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Change photo" }));
    const input = screen.getByLabelText("Upload a new photo");
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText(/That file isn't a photo/)).toBeTruthy();
  });

  it("points a new player at the episode when nothing is scored", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      ...MINE,
      season: { season: "dwts-35", count: 0, mae: null, judges: {}, rank: null, ranked: 0 },
      detail: EMPTY,
    });
    render(<ProfileScreen />);
    const link = await screen.findByRole("link", { name: "Score this week's dances" });
    expect(link.getAttribute("href")).toMatch(/^\/episode\/?$/);
    expect(screen.queryByRole("region", { name: "Accuracy trend" })).toBeNull();
    const panel = await openTab("Accuracy");
    expect(within(panel).getByText("Nothing to compare yet")).toBeTruthy();
  });

  it("offers a retry when the profile fails to load", async () => {
    vi.mocked(getMyProfile).mockRejectedValueOnce(new ApiError(500, "Internal error"));
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Test Viewer" })).toBeTruthy();
  });
});

describe("ProfileScreen, someone else's", () => {
  it("has the same layout, read-only", async () => {
    search.value = new URLSearchParams({ u: "b" });
    render(<ProfileScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Dance Mom" })).toBeTruthy();
    expect(getProfile).toHaveBeenCalledWith("dwts-35", "b");
    expect(getMyProfile).not.toHaveBeenCalled();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Favorites", "Accuracy", "History"]);
    const glance = screen.getByRole("list", { name: "At a glance" });
    expect(within(glance).getByRole("button", { name: "1 friend" })).toBeTruthy();
    expect(within(glance).getByRole("button", { name: "1 shared group" })).toBeTruthy();
    expect(screen.getByText(/accuracy shows once they've scored 5 dances/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit display name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Settings" })).toBeNull();
  });

  it("is your own view when the link carries your own id", async () => {
    search.value = new URLSearchParams({ u: "me" });
    vi.mocked(getProfile).mockResolvedValue(MINE);
    render(<ProfileScreen />);
    expect(await screen.findByRole("button", { name: "Change photo" })).toBeTruthy();
    expect(getMyProfile).toHaveBeenCalled();
  });

  it("compares over dances you've both scored", async () => {
    search.value = new URLSearchParams({ u: "b" });
    render(<ProfileScreen />);
    const accuracy = await openTab("Accuracy");
    expect(within(accuracy).getByText("Over the 2 dances you've both scored.")).toBeTruthy();
    expect(within(accuracy).getByRole("table", { name: /Paddles they gave/ })).toBeTruthy();
    const favorites = await openTab("Favorites");
    expect(getFavorites).toHaveBeenCalledWith("dwts-35", "b");
    expect(await within(favorites).findByText("From the 4 dances you've both scored.")).toBeTruthy();
  });

  it("opens mutual friends and shared groups from the header", async () => {
    search.value = new URLSearchParams({ u: "b" });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Friends with Cara" }));
    const sheet = screen.getByRole("dialog", { name: "Dance Mom's friends and groups" });
    expect(within(sheet).getByText("Dance Mom has 1 friend. You see the ones you share.")).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Cara" }).getAttribute("href")).toMatch(/^\/profile\/?\?u=c$/);
    fireEvent.click(within(sheet).getByRole("tab", { name: "Shared groups" }));
    expect(within(sheet).getByRole("link", { name: /Family/ }).getAttribute("href")).toMatch(/^\/groups\/?\?id=g1$/);
  });

  it("adds them as a friend, then shows the request as sent", async () => {
    search.value = new URLSearchParams({ u: "b" });
    vi.mocked(addFriend).mockResolvedValue({ status: "outgoing", user: { sub: "b", name: "Dance Mom", picture: null, avatarKind: "initials" } });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));
    expect(await screen.findByRole("button", { name: "Requested" })).toBeTruthy();
    expect(addFriend).toHaveBeenCalledWith({ sub: "b" });
  });

  it("accepts their request from the header and counts them as a friend", async () => {
    search.value = new URLSearchParams({ u: "b" });
    vi.mocked(getFriends).mockResolvedValue({
      inviteCode: "x",
      friends: [],
      incoming: [{ sub: "b", name: "Dance Mom", picture: null, avatarKind: "initials", at: null }],
      outgoing: [],
      blocked: [],
    });
    vi.mocked(acceptFriend).mockResolvedValue({ status: "friend" });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByRole("button", { name: "Friends" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2 friends" })).toBeTruthy();
  });

  it("removes a friend from the Friends menu after confirming", async () => {
    search.value = new URLSearchParams({ u: "c" });
    vi.mocked(getProfile).mockResolvedValue({ ...THEIRS, sub: "c", name: "Cara" });
    vi.mocked(removeFriend).mockResolvedValue({ status: null });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Friends" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove friend" }));
    const confirm = screen.getByRole("dialog", { name: "Remove Cara?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove friend" }));
    expect(await screen.findByRole("button", { name: "Add friend" })).toBeTruthy();
    expect(removeFriend).toHaveBeenCalledWith("c");
  });

  it("shows their all-time numbers and recent episodes as counts", async () => {
    search.value = new URLSearchParams({ u: "b" });
    vi.mocked(getProfile).mockResolvedValue({
      ...THEIRS,
      allTime: { count: 42, mae: 1.04, closestJudge: { id: "derek-hough", mae: 0.9 }, rank: 3, ranked: 30 },
      recent: [{ season: "dwts-35", ep: 4, week: 3, theme: "Yacht Rock", airDate: "2026-09-29", answered: 9, scored: 8 }],
    });
    render(<ProfileScreen />);
    const all = await screen.findByRole("region", { name: "All-time" });
    expect(within(all).getByText("42")).toBeTruthy();
    expect(within(all).getByText(/Derek Hough/)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "At a glance" })).getByRole("link", { name: "Rank #3 of 30, all-time" })).toBeTruthy();
    const recent = screen.getByRole("region", { name: "Recent activity" });
    expect(within(recent).getByText("8 dances scored, 1 revealed")).toBeTruthy();
    expect(within(recent).getByRole("link").getAttribute("href")).toBe("/episode?season=dwts-35&ep=04");
  });

  it("says so when the link matches no one", async () => {
    search.value = new URLSearchParams({ u: "nobody" });
    vi.mocked(getProfile).mockRejectedValue(new ApiError(404, "No such user"));
    render(<ProfileScreen />);
    expect(await screen.findByRole("heading", { name: "No one here" })).toBeTruthy();
  });
});
