"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { GoogleMark } from "@/components/google-mark";
import { useAccountHint } from "@/lib/account-hint";
import { continueSignedIn, signInWithGoogle, useAuth } from "@/lib/auth/use-auth";
import { parseWho, rawWho } from "@/lib/auth/who";
import { DWTS_URL } from "@/lib/links";

import { AvatarMenu } from "./avatar-menu";
import { Avatar, FOCUS } from "./ui";

const PILL = `flex min-h-11 items-center gap-2 rounded-full bg-text text-sm font-semibold text-night transition-colors hover:bg-gold active:scale-95 disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;

const noSubscribe = () => () => {};

/** The header's account slot: sign in, continue as someone, or their avatar menu. */
export function AccountButton() {
  const { status } = useAuth();
  const hinted = useAccountHint();
  const raw = useSyncExternalStore(noSubscribe, rawWho, () => null);
  const who = useMemo(() => parseWho(raw), [raw]);
  const [leaving, setLeaving] = useState(false);

  // bfcache brings the page back from the Google redirect with leaving still set.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setLeaving(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (status === "signedIn") return <AvatarMenu />;

  // A build without Cognito config keeps the old hand-off to DWTS.
  if (status === "unconfigured") {
    return (
      <a href={DWTS_URL} aria-label="Sign in" className={`${PILL} ml-1 px-3 sm:px-4`}>
        <GoogleMark className="h-5 w-5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline" aria-hidden="true">
          Sign in
        </span>
      </a>
    );
  }

  if (status === "loading" && hinted) {
    return <span aria-hidden="true" className="skeleton ml-1 block size-11 rounded-full" />;
  }

  const go = (fn: () => Promise<void>) => {
    setLeaving(true);
    fn().catch(() => setLeaving(false));
  };

  if (who) {
    return (
      <button
        type="button"
        disabled={leaving}
        onClick={() => go(continueSignedIn)}
        aria-label={`Continue as ${who.name}`}
        title={`Continue as ${who.name}`}
        className={`${PILL} relative ml-1 py-1 pr-1 pl-1 sm:pr-4`}
      >
        <Avatar name={who.name} picture={who.picture} size={36} decorative />
        {/* On a phone the avatar stands alone; the G says it signs you in, unlike the signed-in avatar. */}
        <GoogleMark className="absolute right-0 bottom-0 h-4 w-4 ring-2 ring-night sm:hidden" />
        <span className="hidden max-w-36 truncate sm:inline" aria-hidden="true">
          Continue as {who.name.split(/\s+/)[0]}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={leaving}
      onClick={() => go(signInWithGoogle)}
      aria-label="Sign in with Google"
      className={`${PILL} ml-1 px-3 sm:px-4`}
    >
      <GoogleMark className="h-5 w-5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline" aria-hidden="true">
        {leaving ? "Signing in..." : "Sign in"}
      </span>
    </button>
  );
}
