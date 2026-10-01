import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/people")>()),
  searchAll: vi.fn(),
}));

import { searchAll, type SearchResults } from "@/lib/api/people";
import { rolesText, SearchBox, seasonsText, sections } from "./people-search";

const RESULTS: SearchResults = {
  users: [{ sub: "u2", name: "Derek Fan", picture: null, avatarKind: "initials", status: "friend" }],
  stars: [],
  pros: [{ id: "derek-hough-sr", name: "Derek Hough Sr", roles: ["pro"], headshot: null, seasons: [3, 4] }],
  judges: [
    { id: "derek-hough", name: "Derek Hough", roles: ["judge", "pro"], headshot: "Derek.jpg", seasons: [1, 2, 3] },
  ],
};

afterEach(() => vi.clearAllMocks());

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

  it("waits for two letters, then lists grouped results", async () => {
    vi.mocked(searchAll).mockResolvedValue(RESULTS);
    render(<SearchBox variant="popover" />);
    fireEvent.change(field(), { target: { value: "d" } });
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.change(field(), { target: { value: "de" } });
    const list = await screen.findByRole("listbox");
    expect(searchAll).toHaveBeenCalledWith("de");
    expect(within(list).getByRole("group", { name: "Judges" })).toBeTruthy();
    expect(within(list).getAllByRole("option").map((o) => o.lastElementChild?.textContent)).toEqual([
      "Derek FanFriend",
      "Derek Hough SrPro · Seasons 3 and 4",
      "Derek HoughJudge and pro · 3 seasons",
    ]);
    expect(field().getAttribute("aria-expanded")).toBe("true");
  });

  it("walks results with the arrow keys and opens one with Enter", async () => {
    vi.mocked(searchAll).mockResolvedValue(RESULTS);
    const onNavigate = vi.fn();
    render(<SearchBox variant="popover" onNavigate={onNavigate} />);
    fireEvent.change(field(), { target: { value: "derek" } });
    const options = await screen.findAllByRole("option");

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

  it("says when no one matches", async () => {
    vi.mocked(searchAll).mockResolvedValue({ users: [], stars: [], pros: [], judges: [] });
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "zz" } });
    expect(await screen.findByText(/No one matches/)).toBeTruthy();
  });

  it("shows a failed search", async () => {
    vi.mocked(searchAll).mockRejectedValue(new Error("Service unavailable"));
    render(<SearchBox variant="inline" />);
    fireEvent.change(field(), { target: { value: "zz" } });
    expect((await screen.findByRole("alert")).textContent).toContain("Service unavailable");
  });

  it("Escape clears the field, then closes", async () => {
    vi.mocked(searchAll).mockResolvedValue(RESULTS);
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
