import { act, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getMe: vi.fn(),
}));

import { getCurrentUser } from "aws-amplify/auth";

import { ApiError, getMe } from "@/lib/api/client";
import { Home } from "./home";

const HEADLINE = { name: "Score every dance. Before the judges do." };

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
  sessionStorage.clear();
});

describe("Landing", () => {
  it("plays the intro into the landing, once per session", async () => {
    const first = render(<Home />);
    expect(await screen.findByRole("button", { name: "Skip intro" })).toBeTruthy();
    expect(screen.queryByRole("heading", HEADLINE)).toBeNull();

    // The landing mounts from an async auth update, so its effects (the intro's timer) flush on the scheduler first.
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => vi.advanceTimersByTime(5199));
    expect(screen.getByRole("button", { name: "Skip intro" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("heading", HEADLINE)).toBeTruthy();
    first.unmount();

    render(<Home />);
    expect(await screen.findByRole("heading", HEADLINE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  });

  it("skips straight to the landing, and stays skipped", async () => {
    const first = render(<Home />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip intro" }));
    expect(screen.getByRole("heading", HEADLINE)).toBeTruthy();
    first.unmount();

    render(<Home />);
    expect(await screen.findByRole("heading", HEADLINE)).toBeTruthy();
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
    expect(await screen.findByRole("img", { name: /^Judges' desk: Marisol Vega 8/ })).toBeTruthy();
    expect(screen.getByText("Illustration with invented couples, judges and scores.")).toBeTruthy();
    expect(screen.getByText("Not affiliated with ABC, Disney or BBC Studios.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "More shows at Armchair Judge" }).getAttribute("href")).toBe(
      "https://armchairjudge.com",
    );
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

    expect(await screen.findByRole("heading", { name: "Hi, Ada Lovelace" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
    expect(screen.queryByRole("heading", HEADLINE)).toBeNull();
  });

  it("shows nothing while the session is still being read", () => {
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}));
    const { container } = render(<Home />);
    expect(container.innerHTML).toBe("");
  });
});
