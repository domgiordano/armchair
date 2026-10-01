"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, signInWithRedirect, signOut as amplifySignOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

import { authConfigured } from "./amplify";
import { rememberReturn } from "./return-to";
import { clearWho } from "./who";

export type AuthStatus = "loading" | "signedIn" | "signedOut" | "unconfigured";

const SILENT_KEY = "armchair-hub.silent";

async function resolveStatus(): Promise<AuthStatus> {
  if (!authConfigured) return "unconfigured";
  try {
    await getCurrentUser();
    return "signedIn";
  } catch {
    // getCurrentUser throws when there is no session; that is just signed out.
    return "signedOut";
  }
}

/** Google sign-in. "Google" becomes identity_provider, which skips Cognito's picker. */
export function signInWithGoogle(): Promise<void> {
  rememberReturn();
  return signInWithRedirect({ provider: "Google" });
}

/**
 * Resumes the session a show app already opened on auth.armchairjudge.com,
 * with prompt=none so nobody sees a sign-in page. When there is none, Cognito
 * answers login_required and the callback falls through to Google.
 */
export function continueSignedIn(): Promise<void> {
  rememberReturn();
  try {
    window.sessionStorage.setItem(SILENT_KEY, "1");
  } catch {
    // Storage disabled: a failed silent attempt shows the error page instead.
  }
  return signInWithRedirect({ options: { prompt: "NONE" } });
}

/** Whether the redirect that just came back was a silent attempt; reading it clears it. */
export function takeSilent(): boolean {
  try {
    const silent = window.sessionStorage.getItem(SILENT_KEY) === "1";
    window.sessionStorage.removeItem(SILENT_KEY);
    return silent;
  } catch {
    return false;
  }
}

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>(authConfigured ? "loading" : "unconfigured");

  const refresh = useCallback(async () => {
    setStatus(await resolveStatus());
  }, []);

  useEffect(() => {
    if (!authConfigured) return;
    let cancelled = false;
    const update = async () => {
      const next = await resolveStatus();
      // A sign-out during the initial read must not be overwritten by it.
      if (!cancelled) setStatus(next);
    };
    void update();

    // The Google sign-in completes outside React: Amplify swaps the code for
    // tokens on load and announces it here.
    const stop = Hub.listen("auth", ({ payload }) => {
      if (
        payload.event === "signInWithRedirect" ||
        payload.event === "signedIn" ||
        payload.event === "signedOut"
      ) {
        void update();
      }
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return {
    status,
    refresh,
    signOut: async () => {
      clearWho();
      await amplifySignOut();
      await refresh();
    },
  };
}
