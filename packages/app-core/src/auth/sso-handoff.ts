"use client";

import { fetchAuthSession, getCurrentUser, signInWithRedirect } from "aws-amplify/auth";
import { useEffect } from "react";

import { authConfigured } from "./amplify";
import { clearFamilySignedIn, familySignedIn, markFamilySignedIn } from "./family";
import { rememberReturn } from "./return-to";
import { markSilent } from "./silent";
import { writeWho } from "./who";

const TRIED = "armchair.sso-tried";

function triedThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(TRIED) === "1") return true;
    window.sessionStorage.setItem(TRIED, "1");
    return false;
  } catch {
    // Storage disabled: no way to stop a loop, so don't start one.
    return true;
  }
}

/**
 * Carries sign-in between the Armchair sites. With no session here, a silent
 * prompt=none sign-in runs when the link asked for it (`?sso=1`) or another site has
 * marked the family cookie, once per browser session so a failure can't loop. With a
 * session, it marks the cookie and records who is signed in for "Continue as".
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
        markFamilySignedIn();
        const claims = (await fetchAuthSession()).tokens?.idToken?.payload;
        const name = claims?.name ?? claims?.email;
        if (cancelled || typeof name !== "string") return;
        writeWho({ name, picture: typeof claims?.picture === "string" ? claims.picture : null });
      },
      () => {
        // No session here; getCurrentUser throws for that.
        if (cancelled || !(handoff || familySignedIn()) || triedThisSession()) return;
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
