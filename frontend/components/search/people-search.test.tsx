import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/social")>()),
  getFriends: vi.fn(),
  searchPeople: vi.fn(),
}));
vi.mock("@/lib/search/people-index.json", () => ({
  default: [
    { id: "derek-hough", name: "Derek Hough", roles: ["judge", "pro"], headshot: "Derek.jpg", seasons: [1, 2, 3, 35] },
    { id: "derek-fisher", name: "Derek Fisher", roles: ["celebrity"], headshot: null, seasons: [25] },
    { id: "witney-carson", name: "Witney Carson", roles: ["pro"], headshot: null, seasons: [16, 35] },
    { id: "jenna-dewan", name: "Jenna Dewan", roles: ["celebrity"], headshot: null, seasons: [35] },
  ],
}));

import type { SearchResults } from "@/lib/api/people";
import { getFriends, searchPeople, type Friends, type Match } from "@/lib/api/social";
import { forgetMembers } from "@/lib/search/people";
import { rolesText, SearchBox, seasonsText, sections } from "./people-search";

const RESULTS: SearchResults = {
  users: [{ sub: "u2", name: "Derek Fan", picture: null, avatarKind: "initials", status: "friend" }],
  stars: [],
  pros: [{ id: "derek-hough-sr", name: "Derek Hough Sr", roles: ["pro"], headshot: null, seasons: [3, 4] }],
  judges: [
    { id: "derek-hough", name: "Derek Hough", roles: ["judge", "pro"], headshot: "derek-hough-0123456789.webp", seasons: [1, 2, 3] },
  ],
};

const contact = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const, at: null });
const FRIENDS: Friends = {
  inviteCode: "X",
  friends: [contact("u2", "Sam Rivera")],
  incoming: [],
  outgoing: [contact("u3", "Derek Fan")],
  blocked: [],
};
const member = (sub: string, name: string): Match => ({ sub, name, picture: null, avatarKind: "initials", status: null });
const never = () => new Promise<never>(() => {});

beforeEach(() => {
  vi.mocked(getFriends).mockResolvedValue(FRIENDS);
  vi.mocked(searchPeople).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  forgetMembers();
});


describe("sections", () => {
  it("keeps the fixed group order, drops empty groups and links each hit", () => {
    const got = sections(RESULTS);
    expect(got.map((s) => s.label)).toEqual(["People", "Pros", "Judges"]);
    expect(got[0].hits[0]).toMatchObject({ href: "/profile/?u=u2", detail: "Friend" });
    expect(got[2].hits[0]).toMatchObject({ href: "/people/?id=derek-hough", detail: "Judge and pro · 3 seasons" });
  });

  it("words seasons and roles", () => {
    expect(seasonsText([20])).toBe("Season 20");
    expect(seasonsText([15, 20])).toBe("Seasons 15 and 20");
    expect(rolesText(["celebrity"])).toBe("Star");
  });
});

describe("SearchBox", () => {
  const field = () => screen.getByRole("combobox", { name: /search people/i });
  const names = () => screen.getAllByRole("option").map((o) => o.lastElementChild?.firstElementChild?.textContent);

  it("waits for two letters, then lists stars, pros and judges before the server answers", async () => {
    vi.mocked(searchPeople).mockImplementation(never);
    render(<SearchBox variant="popover" />);
    fireEvent.change(field(), { target: { value: "d" } });
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.change(field(), { target: { value: "de" } });
    const list = await screen.findByRole("listbox");
    expect(await within(list).findByRole("group", { name: "Judges" })).toBeTruthy();
    expect(within(list).getAllByRole("option").map((o) => o.lastElementChild?.textContent)).toEqual([
      "Derek FanRequest sent",
      "Derek FisherStar · Season 25",
      "Jenna DewanStar · Season 35",
      "Derek HoughJudge and pro · 4 seasons",
    ]);
    expect(field().getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("forgives one typo in a word of four letters or more", async () => {
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "derk hough" } });
    await waitFor(() => expect(names()).toEqual(["Derek Hough"]));
    fireEvent.change(field(), { target: { value: "witny" } });
    await waitFor(() => expect(names()).toEqual(["Witney Carson"]));
  });

  it("finds a friend by any part of their name without asking the server", async () => {
    vi.mocked(searchPeople).mockImplementation(never);
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "rivera" } });
    await waitFor(() => expect(names()).toEqual(["Sam Rivera"]));
  });

  it("adds members from the server after a pause, once per query, contacts first", async () => {
    vi.mocked(searchPeople).mockResolvedValue([member("u3", "Derek Fan"), member("u9", "Derek Zed")]);
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "dere" } });
    await waitFor(() => expect(names()).toContain("Derek Zed"));
    expect(searchPeople).toHaveBeenCalledTimes(1);
    expect(searchPeople).toHaveBeenCalledWith("dere");
    expect(names()).toEqual(["Derek Fan", "Derek Zed", "Derek Fisher", "Derek Hough"]);

    // The list for "dere" wasn't cut off, so "derek z" narrows it here.
    fireEvent.change(field(), { target: { value: "derek z" } });
    await waitFor(() => expect(names()).toEqual(["Derek Zed"]));
    await new Promise((r) => setTimeout(r, 250));
    expect(searchPeople).toHaveBeenCalledTimes(1);
  });

  it("walks results with the arrow keys and opens one with Enter", async () => {
    vi.mocked(searchPeople).mockImplementation(never);
    const onNavigate = vi.fn();
    render(<SearchBox variant="popover" onNavigate={onNavigate} />);
    fireEvent.change(field(), { target: { value: "derek" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    const options = screen.getAllByRole("option");

    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(field().getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(field().getAttribute("aria-activedescendant")).toBe(options[2].id);

    fireEvent.keyDown(field(), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/people/?id=derek-hough");
    expect(onNavigate).toHaveBeenCalled();
    expect((field() as HTMLInputElement).value).toBe("");
  });

  it("says when no one matches, once the server has answered", async () => {
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "zz" } });
    expect(await screen.findByText(/No one matches/)).toBeTruthy();
    expect(searchPeople).toHaveBeenCalledWith("zz");
  });

  it("shows a failed member search and keeps the stars", async () => {
    vi.mocked(searchPeople).mockRejectedValue(new Error("Service unavailable"));
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "jenna" } });
    expect((await screen.findByRole("alert")).textContent).toContain("Service unavailable");
    expect(names()).toEqual(["Jenna Dewan"]);
  });

  it("Escape clears the field, then closes", async () => {
    const onEscape = vi.fn();
    render(<SearchBox variant="inline" onEscape={onEscape} />);
    fireEvent.change(field(), { target: { value: "derek" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect((field() as HTMLInputElement).value).toBe("");
    expect(onEscape).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "Escape" });
    await waitFor(() => expect(onEscape).toHaveBeenCalled());
  });
});
