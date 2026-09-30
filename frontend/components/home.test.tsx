import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// amplify.ts reads these at import time, so they must exist before any import.
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

import { getCurrentUser, signInWithRedirect, signOut } from "aws-amplify/auth";

import { ApiError, getMe } from "@/lib/api/client";
import { Home } from "./home";

const ME = {
  sub: "abc",
  email: "viewer@example.com",
  name: "Ada Lovelace",
  picture: null,
  avatarKind: "initials" as const,
  createdAt: "2026-09-30T12:00:00+00:00",
  lastSeenAt: "2026-09-30T12:00:00+00:00",
};

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("Home", () => {
  it("sends a signed-out visitor straight to Google", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("no session"));
    vi.mocked(getMe).mockRejectedValue(new ApiError(401, "Not signed in"));
    render(<Home />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip intro" }));

    const button = await screen.findByRole("button", { name: "Sign in with Google" });
    await vi.waitFor(() => expect(button).toHaveProperty("disabled", false));
    fireEvent.click(button);

    expect(signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
    expect(await screen.findByRole("button", { name: "Opening Google..." })).toHaveProperty("disabled", true);
  });

  it("shows the signed-in user's avatar and name from /users/me", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
    vi.mocked(getMe).mockResolvedValue(ME);
    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Hi, Ada Lovelace" })).toBeTruthy();
    expect((await screen.findByRole("img", { name: "Ada Lovelace" })).textContent).toBe("AL");

    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });

  it("offers a retry when /users/me fails", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: "u", userId: "u" });
    // Once for the header's avatar, once for the greeting.
    vi.mocked(getMe)
      .mockRejectedValueOnce(new ApiError(500, "Internal error"))
      .mockRejectedValueOnce(new ApiError(500, "Internal error"))
      .mockResolvedValue(ME);
    render(<Home />);

    expect(await screen.findByText("Could not load your profile: Internal error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Hi, Ada Lovelace" })).toBeTruthy();
  });
});
