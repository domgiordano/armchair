"use client";

import { signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BUTTON } from "@/lib/ui";
import { takeReturn } from "@armchair/app-core/auth/return-to";
import { takeSilent } from "@armchair/app-core/auth/silent";
import { useAuth } from "@armchair/app-core/auth/use-auth";

// A Hosted UI round trip can fail without the browser reporting it (revoked
// consent, clock skew, a code already redeemed), so after this long the page
// says so instead of waiting forever.
const TIMEOUT_MS = 8000;

/** Waits for Amplify, which reads `?code=` and exchanges it on load, then goes back where sign-in began. */
export function AuthCallback() {
  const router = useRouter();
  const { status, refresh } = useAuth();
  const [failed, setFailed] = useState(false);
  // Read once: a second run of the effect below would find the path already taken.
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void refresh();
      if (payload.event !== "signInWithRedirect_failure") return;
      // A hub hand-off (components/sso-handoff.tsx) with no Armchair session
      // left: Google signs a returning user straight back in instead.
      if (takeSilent()) {
        void signInWithRedirect({ provider: "Google" }).catch(() => setFailed(true));
        return;
      }
      setFailed(true);
    });
    const timer = setTimeout(() => setFailed(true), TIMEOUT_MS);
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    // replace(), not push(): the callback URL holds a spent authorization code.
    if (status !== "signedIn") return;
    takeSilent();
    returnTo.current ??= takeReturn();
    router.replace(returnTo.current);
  }, [status, router]);

  if (failed && status !== "signedIn") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <div role="alert" className="flex flex-col gap-4 rounded-sm border border-oxblood bg-stone p-6">
          <h1 className="font-display text-xl text-bone">That sign-in did not finish</h1>
          <p className="text-ash">The link may have expired, or the window sat open too long. Try again.</p>
          <Link href="/" className={BUTTON}>
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6">
      <p role="status" className="font-display tracking-[0.12em] text-ash uppercase">
        Signing you in...
      </p>
    </main>
  );
}
