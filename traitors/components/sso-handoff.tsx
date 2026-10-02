"use client";

import { fetchAuthSession, getCurrentUser, signInWithRedirect } from "aws-amplify/auth";
import { useEffect } from "react";

import { authConfigured } from "@armchair/app-core/auth/amplify";
import { rememberReturn } from "@armchair/app-core/auth/return-to";
import { markSilent } from "@armchair/app-core/auth/silent";
import { writeWho } from "@armchair/app-core/auth/who";

/**
 * Links from the hub carry `?sso=1`. Without a session here, that resumes the
 * Armchair one silently (prompt=none) instead of showing the landing. With a
 * session, it records who is signed in for the hub's "Continue as" button.
 */
export function SsoHandoff() {
  useEffect(() => {
    if (!authConfigured) return;
    const url = new URL(window.location.href);
    const handoff = url.searchParams.get("sso") === "1";
    if (handoff) {
      url.searchParams.delete("sso");
      // null, not history.state: the app router skips its own URL sync for its state object.
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }

    let cancelled = false;
    getCurrentUser().then(
      async () => {
        const claims = (await fetchAuthSession()).tokens?.idToken?.payload;
        const name = claims?.name ?? claims?.email;
        if (cancelled || typeof name !== "string") return;
        writeWho({ name, picture: typeof claims?.picture === "string" ? claims.picture : null });
      },
      () => {
        // No session here; getCurrentUser throws for that.
        if (cancelled || !handoff) return;
        rememberReturn();
        markSilent();
        void signInWithRedirect({ options: { prompt: "NONE" } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
