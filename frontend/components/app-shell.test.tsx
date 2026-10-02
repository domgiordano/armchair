import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  pathname: "/",
  search: new URLSearchParams(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => nav.search,
}));
const signOut = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/auth/use-auth", () => ({ useAuth: () => ({ signOut }) }));
vi.mock("@/lib/api/client", () => ({ getMe: vi.fn() }));
const unread = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/social/notifications", () => ({
  useNotifications: () => ({ unread: unread.n, items: [], loaded: true, error: null, more: false }),
  useMarkAllReadOnView: () => {},
}));

import { getMe } from "@/lib/api/client";
import { parentOf, resetHistory } from "@/lib/nav/back";
import { activeTab, AppShell } from "./app-shell";

const ME = {
  sub: "abc",
  email: "viewer@example.com",
  name: "Ada Lovelace",
  picture: null,
  avatarKind: "initials" as const,
  createdAt: "2026-09-30T12:00:00+00:00",
  lastSeenAt: "2026-09-30T12:00:00+00:00",
};

// A fresh element each call, so a rerender re-reads the mocked URL.
const shell = () => (
  <AppShell title="Groups">
    <p>page body</p>
  </AppShell>
);

function renderShell() {
  vi.mocked(getMe).mockResolvedValue(ME);
  return render(shell());
}

// next/link outside a Next build drops the trailing slash that trailingSlash: true keeps.
const href = (el: HTMLElement) => el.getAttribute("href")?.replace(/\/(?=\?|$)/, "");

// Desktop tabs and the phone sheet both carry a "Main" nav; the tabs come first.
const tabs = () => within(screen.getAllByRole("navigation", { name: "Main" })[0]);

afterEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/";
  nav.search = new URLSearchParams();
  unread.n = 0;
  resetHistory();
  window.history.replaceState(null, "");
});

describe("activeTab", () => {
  it.each([
    ["/", "Overview"],
    ["/episode/", "Episodes"],
    ["/episode", "Episodes"],
    ["/stats/", "Stats"],
    ["/couples/", "Couples"],
    ["/discover/", "Discover"],
    ["/people/", "Discover"],
  ])("%s lights %s", (path, label) => {
    expect(activeTab(path)?.label).toBe(label);
  });

  it("lights nothing on a page outside the tabs", () => {
    expect(activeTab("/notifications/")).toBeUndefined();
    expect(activeTab("/credits/")).toBeUndefined();
    expect(activeTab("/profile/")).toBeUndefined();
    expect(activeTab("/groups/")).toBeUndefined();
    expect(activeTab("/friends/")).toBeUndefined();
  });
});

describe("AppShell", () => {
  it("marks the current tab, with friends and groups on profiles rather than a tab", async () => {
    nav.pathname = "/discover/";
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });

    const current = tabs().getByRole("link", { current: "page" });
    expect(current.textContent).toBe("Discover");
    expect(href(current)).toBe("/discover");
    expect(tabs().getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Overview",
      "Episodes",
      "Leaderboard",
      "Stats",
      "Couples",
      "Discover",
    ]);
    expect(screen.getByRole("main", { name: "Groups" }).textContent).toBe("page body");
  });

  it("carries a past season through every tab and switches season from the picker", async () => {
    nav.pathname = "/stats/";
    nav.search = new URLSearchParams("season=dwts-34");
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });

    expect(href(tabs().getByRole("link", { name: "Episodes" }))).toBe("/episode?season=dwts-34");
    const [picker] = screen.getAllByRole("combobox", { name: "Season" });
    expect(picker.textContent).toBe("Season 34");

    fireEvent.click(picker);
    fireEvent.click(screen.getByRole("option", { name: "Season 35" }));
    expect(nav.push).toHaveBeenCalledWith("/stats/");
  });

  it("falls back to the current season for a malformed param", async () => {
    nav.search = new URLSearchParams("season=<script>");
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });

    const [picker] = screen.getAllByRole("combobox", { name: "Season" });
    expect(picker.textContent).toBe("Season 35");
    expect(href(tabs().getByRole("link", { name: "Stats" }))).toBe("/stats");
  });

  it("says how many notifications are unread", async () => {
    unread.n = 12;
    renderShell();
    const bell = await screen.findByRole("link", { name: "Notifications, 12 unread" });
    expect(href(bell)).toBe("/notifications");
    expect(bell.textContent).toBe("9+");
  });

  it("opens the account menu with Your profile and Sign out, and Escape closes it back onto its button", async () => {
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });
    const account = screen.getByRole("button", { name: "Account" });

    fireEvent.click(account);
    expect(account.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: "Account" });
    expect(menu.id).toBe(account.getAttribute("aria-controls"));
    const profile = within(menu).getByRole("menuitem", { name: "Your profile" });
    expect(href(profile)).toBe("/profile");
    expect(document.activeElement).toBe(profile);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Sign out" }));
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(profile);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(account.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(account);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(account);
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/"));
  });

  it("closes a menu on a click outside it", async () => {
    renderShell();
    const apps = screen.getByRole("button", { name: "Apps" });
    fireEvent.click(apps);
    expect(screen.getByRole("menuitem", { name: "All shows" }).getAttribute("href")).toBe("https://armchairjudge.com");
    const menu = screen.getByRole("menu", { name: "Apps" });
    const icons = [...menu.querySelectorAll("[data-show]")].map((el) => [el.getAttribute("data-show"), !!el.querySelector("span")]);
    expect(icons).toEqual([
      ["dwts", false],
      ["traitors", true],
      ["survivor", true],
    ]);
    expect(within(menu).getByText("Dancing with the Stars").closest("[aria-current]")?.getAttribute("aria-current")).toBe("page");

    fireEvent.pointerDown(screen.getByText("page body"));
    expect(apps.getAttribute("aria-expanded")).toBe("false");
    await screen.findByRole("img", { name: "Ada Lovelace" });
  });

  it("opens the phone menu as a dialog and returns focus to the hamburger on close", async () => {
    nav.pathname = "/episode/";
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });
    const hamburger = screen.getByRole("button", { name: "Open menu" });

    fireEvent.click(hamburger);
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    expect(sheet.hasAttribute("open")).toBe(true);
    expect(within(sheet).getByRole("link", { current: "page" }).textContent).toBe("Episodes");
    expect(within(sheet).getByRole("combobox", { name: "Season" })).toBeTruthy();

    act(() => within(sheet).getByRole("button", { name: "Close menu" }).click());
    expect(sheet.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(hamburger);
  });

  it("closes the phone menu when a destination is picked", async () => {
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });

    fireEvent.click(within(sheet).getByRole("link", { name: "Leaderboard" }));
    expect(sheet.hasAttribute("open")).toBe(false);
  });

  it("opens phone search as a full-screen dialog and returns focus to its button on Cancel", async () => {
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });
    const open = screen.getByRole("button", { name: "Search" });

    fireEvent.click(open);
    const sheet = screen.getByRole("dialog", { name: "Search" });
    expect(sheet.hasAttribute("open")).toBe(true);
    expect(within(sheet).getByRole("combobox", { name: /search people/i })).toBeTruthy();

    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(sheet.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(open);
  });
});

describe("parentOf", () => {
  it.each([
    ["/couples/couple/", "id=amber-glenn", "/couples/"],
    ["/couples/couple/", "id=amber-glenn&season=dwts-34", "/couples/?season=dwts-34"],
    ["/people/", "id=derek-hough", "/discover/"],
    ["/groups/", "id=g1", "/profile/"],
    ["/friends/", "", "/profile/"],
    ["/profile/", "", "/"],
    ["/profile/", "u=abc", "/discover/"],
    ["/notifications/", "", "/"],
    ["/credits/", "", "/"],
  ])("%s?%s goes up to %s", (path, query, parent) => {
    const params = new URLSearchParams(query);
    expect(parentOf(path, params, params.get("season") ?? "dwts-35")).toBe(parent);
  });
});

describe("Back", () => {
  it.each(["/", "/episode/", "/leaderboard/", "/stats/", "/couples/", "/discover/"])("has no Back on the %s tab", async (path) => {
    nav.pathname = path;
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
  });

  it("links up to the parent on a page opened without in-app history", async () => {
    nav.pathname = "/couples/couple/";
    nav.search = new URLSearchParams("season=dwts-34&id=amber-glenn");
    const back = vi.spyOn(window.history, "back");
    renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });

    const link = screen.getByRole("link", { name: "Back" });
    expect(href(link)).toBe("/couples?season=dwts-34");
    fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
  });

  it("steps back through history once the app has pushed a page", async () => {
    nav.pathname = "/discover/";
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender } = renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });

    window.history.pushState(null, "", "/people/?id=derek-hough");
    nav.pathname = "/people/";
    nav.search = new URLSearchParams("id=derek-hough");
    rerender(shell());

    const link = screen.getByRole("link", { name: "Back" });
    expect(href(link)).toBe("/discover");
    expect(fireEvent.click(link)).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("treats a replaced URL as the same entry, so Back still goes up rather than off the site", async () => {
    nav.pathname = "/people/";
    nav.search = new URLSearchParams("id=derek-hough");
    const back = vi.spyOn(window.history, "back");
    const { rerender } = renderShell();
    await screen.findByRole("img", { name: "Ada Lovelace" });

    window.history.replaceState(null, "", "/people/?id=derek-hough&season=dwts-34");
    nav.search = new URLSearchParams("id=derek-hough&season=dwts-34");
    rerender(shell());

    const link = screen.getByRole("link", { name: "Back" });
    fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
    expect(href(link)).toBe("/discover?season=dwts-34");
  });
});
