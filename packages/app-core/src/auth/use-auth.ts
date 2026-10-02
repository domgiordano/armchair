"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, signInWithRedirect, signOut as amplifySignOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

import { clearCache } from "../api/cache";

import { authConfigured } from "./amplify";
import { clearWho } from "./who";

export type AuthStatus = "loading" | "signedIn" | "signedOut" | "unconfigured";

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
      clearCache();
      await amplifySignOut();
      await refresh();
    },
    // "Google" becomes the Hosted UI's identity_provider param, which skips
    // Cognito's provider picker and lands straight on Google.
    signInWithGoogle: () => signInWithRedirect({ provider: "Google" }),
  };
}
