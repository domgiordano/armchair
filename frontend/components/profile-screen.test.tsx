import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { search, push, signOut } = vi.hoisted(() => ({
  search: { value: new URLSearchParams() },
  push: vi.fn(),
  signOut: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/",
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => search.value,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({ status: "signedIn", signInWithGoogle: vi.fn(), signOut }),
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

import { ApiError } from "@/lib/api/client";
import { getMyProfile, getProfile, updateProfile, uploadAvatar, type MyProfile, type Profile } from "@/lib/api/profile";
import { getSeason, type Season } from "@/lib/api/show";
import { ProfileScreen } from "./profile-screen";

const SEASON: Season = {
  season: "dwts-35",
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
    judges: {
      "carrie-ann-inaba": { count: 3, mae: 1.5 },
      "derek-hough": { count: 3, mae: 0.5 },
    },
  },
  dances: [
    { ep: 3, key: "tyler-cameron#1", style: "Tango", paddle: 6, panelMean: 8, error: 2 },
    { ep: 4, key: "amber-glenn#1", style: "Rumba", paddle: 8, panelMean: 8, error: 0 },
    { ep: 4, key: "tyler-cameron#1", style: "Tango", paddle: 9, panelMean: 7, error: 2 },
  ],
};

const THEIRS: Profile = {
  sub: "b",
  name: "Dance Mom",
  picture: null,
  avatarKind: "initials",
  memberSince: "2026-09-12T00:00:00+00:00",
  friendCount: 1,
  season: { season: "dwts-35", count: 3, mae: null, judges: {} },
};

beforeEach(() => {
  search.value = new URLSearchParams();
  vi.mocked(getSeason).mockResolvedValue(SEASON);
  vi.mocked(getMyProfile).mockResolvedValue(ME);
  vi.mocked(getProfile).mockImplementation(async (_season, sub) => (sub ? THEIRS : MINE));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("ProfileScreen, your own", () => {
  it("shows who you are, your counts and the season's numbers", async () => {
    render(<ProfileScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Test Viewer" })).toBeTruthy();
    expect(screen.getByText("Member since September 2026")).toBeTruthy();
    expect(getProfile).toHaveBeenCalledWith("dwts-35");

    const people = screen.getByRole("navigation", { name: "Your people" });
    expect(
      within(people)
        .getByRole("link", { name: /3\s*Friends/ })
        .getAttribute("href"),
    ).toMatch(/^\/friends\/?$/);
    expect(
      within(people)
        .getByRole("link", { name: /2\s*Groups/ })
        .getAttribute("href"),
    ).toMatch(/^\/groups\/?$/);

    expect(screen.getByText("1.3 off")).toBeTruthy();
    expect(screen.getByText("Derek Hough")).toBeTruthy();
  });

  it("charts accuracy by style and names the best and worst calls", async () => {
    render(<ProfileScreen />);
    const styles = await screen.findByRole("region", { name: "By dance style" });
    const rows = within(styles).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual(["Rumba1 dance0 off", "Tango2 dances2 off"]);

    const calls = screen.getByRole("region", { name: "Best and worst calls" });
    const [best, worst] = within(calls).getAllByRole("listitem");
    expect(best.textContent).toContain("Amber Glenn");
    expect(best.textContent).toContain("Rumba · Week 3");
    expect(worst.textContent).toContain("Tyler Cameron");
    expect(worst.textContent).toContain("Tango · Week 2");

    const table = screen.getByRole("table", { name: /Paddles you gave/ });
    expect(within(table).getByRole("row", { name: "8 1 2" })).toBeTruthy();
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

  it("switches to initials from the photo editor", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ...ME, picture: null, avatarKind: "initials" });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Change photo" }));
    const editor = screen.getByRole("region", { name: "Profile photo" });
    expect(within(editor).getByRole("radio", { name: "Google photo" })).toHaveProperty("checked", true);
    expect(within(editor).queryByRole("radio", { name: "Your upload" })).toBeNull();
    await act(async () => {
      fireEvent.click(within(editor).getByRole("radio", { name: "Initials" }));
    });
    expect(updateProfile).toHaveBeenCalledWith({ avatar: "initials" });
    expect(await screen.findByText("Photo updated.")).toBeTruthy();
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

  it("signs out and goes home", async () => {
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalled();
  });

  it("points a new player at the episode when nothing is scored", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      ...MINE,
      season: { season: "dwts-35", count: 0, mae: null, judges: {} },
      dances: [],
    });
    render(<ProfileScreen />);
    const link = await screen.findByRole("link", { name: "Score this week's dances" });
    expect(link.getAttribute("href")).toMatch(/^\/episode\/?$/);
    expect(screen.queryByRole("region", { name: "By dance style" })).toBeNull();
  });

  it("offers a retry when the profile fails to load", async () => {
    vi.mocked(getMyProfile).mockRejectedValueOnce(new ApiError(500, "Internal error"));
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Test Viewer" })).toBeTruthy();
  });
});

describe("ProfileScreen, someone else's", () => {
  it("is read-only and shows aggregates only", async () => {
    search.value = new URLSearchParams({ u: "b" });
    render(<ProfileScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Dance Mom" })).toBeTruthy();
    expect(getProfile).toHaveBeenCalledWith("dwts-35", "b");
    expect(getMyProfile).not.toHaveBeenCalled();
    expect(screen.getByText("1 friend")).toBeTruthy();
    expect(screen.getByText(/Accuracy shows once they've scored 5 dances/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit display name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("shows their all-time numbers and recent episodes as counts", async () => {
    search.value = new URLSearchParams({ u: "b" });
    vi.mocked(getProfile).mockResolvedValue({
      ...THEIRS,
      allTime: { count: 42, mae: 1.04, closestJudge: { id: "derek-hough", mae: 0.9 } },
      recent: [{ ep: 4, week: 3, theme: "Yacht Rock", airDate: "2026-09-29", answered: 9, scored: 8 }],
    });
    render(<ProfileScreen />);
    const all = await screen.findByRole("region", { name: "All-time" });
    expect(within(all).getByText("42")).toBeTruthy();
    expect(within(all).getByText("Derek Hough")).toBeTruthy();
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
