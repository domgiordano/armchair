import { act, render, waitFor } from "@testing-library/react";
import { Hub } from "aws-amplify/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthCallback } from "@/components/auth-callback";
import { SsoHandoff } from "@armchair/app-core/auth/sso-handoff";
import { takeReturn } from "@armchair/app-core/auth/return-to";

const auth = vi.hoisted(() => ({
  signedIn: false,
  signInWithRedirect: vi.fn(async () => {}),
}));

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: async () => {
    if (!auth.signedIn) throw new Error("UserUnAuthenticatedException");
    return { userId: "me-1" };
  },
  fetchAuthSession: async () => ({ tokens: { idToken: { payload: { name: "Pat Couch", picture: "https://example.test/p.jpg" } } } }),
  signInWithRedirect: auth.signInWithRedirect,
  signOut: vi.fn(),
}));
vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const who = () => decodeURIComponent(document.cookie.match(/armchair_who=([^;]*)/)?.[1] ?? "");

beforeEach(() => {
  auth.signedIn = false;
  sessionStorage.clear();
  document.cookie = "armchair_signed_in=; Path=/; Max-Age=0";
});

afterEach(() => {
  vi.clearAllMocks();
  document.cookie = "armchair_who=; Path=/; Max-Age=0";
  window.history.replaceState(null, "", "/");
});

describe("hub hand-off", () => {
  it("resumes the Armchair session silently and comes back to the same page", async () => {
    window.history.replaceState(null, "", "/profile/?u=u-1&sso=1");
    render(<SsoHandoff />);
    await waitFor(() => expect(auth.signInWithRedirect).toHaveBeenCalledWith({ options: { prompt: "NONE" } }));
    expect(window.location.search).toBe("?u=u-1");
    expect(takeReturn()).toBe("/profile/?u=u-1");
  });

  it("leaves a visitor without the param on the landing", async () => {
    render(<SsoHandoff />);
    await act(async () => {});
    expect(auth.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("records who is signed in for the hub's Continue as button", async () => {
    auth.signedIn = true;
    window.history.replaceState(null, "", "/?sso=1");
    render(<SsoHandoff />);
    await waitFor(() => expect(who()).toBe('{"name":"Pat Couch","picture":"https://example.test/p.jpg"}'));
    expect(auth.signInWithRedirect).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("falls through to Google when the silent attempt finds no session", async () => {
    sessionStorage.setItem("armchair.silent", "1");
    render(<AuthCallback />);
    act(() => Hub.dispatch("auth", { event: "signInWithRedirect_failure", data: { error: new Error("login_required") } }));
    expect(auth.signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
  });
});

describe("signed in on another Armchair site", () => {
  it("signs in silently once when the family cookie says so, with no param", async () => {
    document.cookie = "armchair_signed_in=1; Path=/";
    render(<SsoHandoff />);
    await waitFor(() => expect(auth.signInWithRedirect).toHaveBeenCalledWith({ options: { prompt: "NONE" } }));
  });

  it("doesn't try again in the same browser session, so a failure can't loop", async () => {
    document.cookie = "armchair_signed_in=1; Path=/";
    sessionStorage.setItem("armchair.sso-tried", "1");
    render(<SsoHandoff />);
    await act(async () => {});
    expect(auth.signInWithRedirect).not.toHaveBeenCalled();
  });
});
