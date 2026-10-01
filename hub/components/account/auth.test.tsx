import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Hub } from "aws-amplify/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberReturn, takeReturn } from "@/lib/auth/return-to";
import { resetMe } from "@/lib/me";
import { resetNotifications } from "@/lib/notifications";

import { AccountButton } from "./account-button";
import { AuthCallback } from "./auth-callback";
import { HomeSwitch } from "./home-switch";
import { stubApi } from "./test-api";

const auth = vi.hoisted(() => ({
  signedIn: false,
  signInWithRedirect: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => {
    if (!auth.signedIn) throw new Error("UserUnAuthenticatedException");
    return { userId: "me-1" };
  },
  signInWithRedirect: auth.signInWithRedirect,
  signOut: auth.signOut,
}));
vi.mock("@/lib/auth/amplify", () => ({ authConfigured: true }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/" }));

const landing = <p>The landing</p>;

beforeEach(() => {
  auth.signedIn = false;
  resetMe();
  resetNotifications();
  stubApi();
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  delete document.documentElement.dataset.account;
  document.cookie = "armchair_who=; Path=/; Max-Age=0";
  window.history.replaceState(null, "", "/");
});

describe("home: landing or dashboard", () => {
  it("keeps the landing for a visitor", async () => {
    render(<HomeSwitch>{landing}</HomeSwitch>);
    expect(screen.getByText("The landing")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("The landing")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: /Welcome back/ })).toBeNull();
  });

  it("swaps to the dashboard once the session is read", async () => {
    auth.signedIn = true;
    render(<HomeSwitch>{landing}</HomeSwitch>);
    expect(await screen.findByRole("heading", { level: 1, name: /Welcome back, Pat\./ })).toBeTruthy();
    expect(screen.queryByText("The landing")).toBeNull();
  });

  it("holds the landing back while a hinted session is read, then lets the boot loader go", async () => {
    document.documentElement.dataset.account = "1";
    render(<HomeSwitch>{landing}</HomeSwitch>);
    expect(screen.queryByText("The landing")).toBeNull();
    // No session after all: the landing comes back and the CSS hint is cleared.
    expect(await screen.findByText("The landing")).toBeTruthy();
    expect(document.documentElement.dataset.account).toBeUndefined();
  });

  it("goes back to the landing on sign-out", async () => {
    auth.signedIn = true;
    render(<HomeSwitch>{landing}</HomeSwitch>);
    await screen.findByRole("heading", { name: /Welcome back/ });
    auth.signedIn = false;
    act(() => Hub.dispatch("auth", { event: "signedOut" }));
    expect(await screen.findByText("The landing")).toBeTruthy();
  });
});

describe("header account button", () => {
  it("signs in on the hub with Google, remembering the page", async () => {
    window.history.replaceState(null, "", "/profile/");
    render(<AccountButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
    expect(auth.signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
    expect(takeReturn()).toBe("/profile/");
  });

  it("offers one-tap continue to someone who signed in before, resuming silently", async () => {
    document.cookie = `armchair_who=${encodeURIComponent(JSON.stringify({ name: "Pat Couch", picture: null }))}; Path=/`;
    render(<AccountButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Pat Couch" }));
    expect(auth.signInWithRedirect).toHaveBeenCalledWith({ options: { prompt: "NONE" } });
  });

  it("ignores a mangled who cookie", async () => {
    document.cookie = "armchair_who=%7Bnot-json; Path=/";
    render(<AccountButton />);
    expect(await screen.findByRole("button", { name: "Sign in with Google" })).toBeTruthy();
  });

  it("is the avatar menu once signed in, with Profile and Sign out", async () => {
    auth.signedIn = true;
    render(<AccountButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Account: Pat Couch" }));
    // next/link drops the trailing slash outside a trailingSlash build.
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toMatch(/^\/profile\/?$/);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
    expect(document.cookie).not.toContain("armchair_who=%7B");
  });
});

describe("auth callback", () => {
  it("returns to the page sign-in started from", async () => {
    window.history.replaceState(null, "", "/profile/");
    rememberReturn();
    auth.signedIn = true;
    render(<AuthCallback />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile/"));
  });

  it("refuses a return path pointing off-site", () => {
    sessionStorage.setItem("armchair-hub.returnTo", "//evil.example/");
    expect(takeReturn()).toBe("/");
  });

  it("falls through to Google when a silent continue finds no session", async () => {
    sessionStorage.setItem("armchair-hub.silent", "1");
    render(<AuthCallback />);
    await screen.findByRole("status");
    act(() => Hub.dispatch("auth", { event: "signInWithRedirect_failure", data: { error: new Error("login_required") } }));
    expect(auth.signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says so when an ordinary sign-in fails", async () => {
    render(<AuthCallback />);
    act(() => Hub.dispatch("auth", { event: "signInWithRedirect_failure", data: { error: new Error("bad code") } }));
    expect((await screen.findByRole("alert")).textContent).toContain("That sign-in did not finish");
    expect(auth.signInWithRedirect).not.toHaveBeenCalled();
  });
});
