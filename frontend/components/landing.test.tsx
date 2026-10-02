import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
vi.mock("@armchair/app-core/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/client")>()),
  getMe: vi.fn(),
}));

import { getCurrentUser } from "aws-amplify/auth";

import { ApiError, getMe } from "@armchair/app-core/api/client";
import { Home } from "./home";

const HEADLINE = { name: "score every dance. before the judges do." };

function reduceMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(getCurrentUser).mockRejectedValue(new Error("no session"));
  vi.mocked(getMe).mockRejectedValue(new ApiError(401, "Not signed in"));
  reduceMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("Landing", () => {
  it("plays the intro into the landing on every visit", async () => {
    const first = render(<Home />);
    expect(await screen.findByRole("button", { name: "Skip intro" })).toBeTruthy();
    expect(screen.queryByRole("heading", HEADLINE)).toBeNull();

    // jsdom has no WebGL, so this is the 2D stage, which waits on its ball sprite.
    fireEvent.load(document.querySelector("section[aria-label=Intro] img[hidden]")!);
    // shouldAdvanceTime lets real time slip in, so stop short of 5.8 s before checking it's still on.
    await act(() => vi.advanceTimersByTimeAsync(5600));
    expect(screen.getByRole("button", { name: "Skip intro" })).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByRole("heading", HEADLINE)).toBeTruthy();
    first.unmount();

    render(<Home />);
    expect(await screen.findByRole("button", { name: "Skip intro" })).toBeTruthy();
    expect(screen.queryByRole("heading", HEADLINE)).toBeNull();
  });

  it("skips straight to the landing", async () => {
    render(<Home />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip intro" }));
    expect(screen.getByRole("heading", HEADLINE)).toBeTruthy();
  });

  it("never plays the intro under reduced motion", async () => {
    reduceMotion(true);
    render(<Home />);
    expect(await screen.findByRole("heading", HEADLINE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  });

  it("shows the invented-data desk and the not-affiliated line", async () => {
    reduceMotion(true);
    render(<Home />);
    expect(await screen.findByRole("group", { name: /^Judges' desk: Marisol Vega 8/ })).toBeTruthy();
    expect(screen.getByText("Illustration with invented couples, judges and scores.")).toBeTruthy();
    expect(screen.getByText("Not affiliated with ABC, Disney, BBC, BBC Studios, NBC, Peacock or The Traitors.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "armchairjudge.com" }).getAttribute("href")).toBe(
      "https://armchairjudge.com",
    );
  });

  it("has a top nav with the page links, the apps and Google sign-in", async () => {
    reduceMotion(true);
    render(<Home />);
    const nav = (await screen.findAllByRole("navigation", { name: "Main" }))[0];
    expect(within(nav).getByRole("link", { name: "How it works" }).getAttribute("href")).toBe("#how");
    expect(within(nav).getByRole("link", { name: "Discover" }).getAttribute("href")).toMatch(/^\/discover\/?$/);

    fireEvent.click(within(nav).getByRole("button", { name: "Apps" }));
    const apps = screen.getByRole("menu", { name: "Apps" });
    expect(within(apps).getByRole("menuitem", { name: /The Traitors/ }).getAttribute("href")).toBe(
      "https://traitors.armchairjudge.com/?sso=1",
    );
    expect(within(apps).getByRole("menuitem", { name: "All shows" }).getAttribute("href")).toBe("https://armchairjudge.com");

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
  });

  it("footer links the other apps, the legal pages, GitHub and Xomware", async () => {
    reduceMotion(true);
    render(<Home />);
    const footer = await screen.findByRole("contentinfo");
    const href = (name: string) => within(footer).getByRole("link", { name }).getAttribute("href");
    expect(href("GitHub")).toBe("https://github.com/domgiordano/armchair");
    expect(href("A Xomware app")).toBe("https://xomware.com");
    expect(href("Privacy")).toBe("https://armchairjudge.com/privacy/");
    expect(href("Photo credits")).toMatch(/^\/credits\/?$/);
    expect(within(footer).getByRole("link", { name: /^The Traitors/ }).getAttribute("href")).toBe("https://traitors.armchairjudge.com");
    expect(within(footer).getByText("Survivor").closest("a")).toBeNull();
  });

  it("keeps signed-in users on their home, with no intro or landing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
    vi.mocked(getMe).mockResolvedValue({
      sub: "abc",
      email: "viewer@example.com",
      name: "Ada Lovelace",
      picture: null,
      avatarKind: "initials",
      createdAt: "2026-09-30T12:00:00+00:00",
      lastSeenAt: "2026-09-30T12:00:00+00:00",
    });
    render(<Home />);

    expect(await screen.findByRole("main", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
    expect(screen.queryByRole("heading", HEADLINE)).toBeNull();
  });

  it("opens on the intro while the session is still being read", () => {
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}));
    render(<Home />);
    expect(screen.getByRole("button", { name: "Skip intro" })).toBeTruthy();
  });

  it("shows nothing while a returning user's session is read", () => {
    localStorage.setItem("CognitoIdentityServiceProvider.client.LastAuthUser", "someone");
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}));
    const { container } = render(<Home />);
    expect(container.innerHTML).toBe("");
  });
});
