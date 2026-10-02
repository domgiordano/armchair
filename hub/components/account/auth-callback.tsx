"use client";

import { signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ChairLoader } from "@/components/chair-loader";
import { takeReturn } from "@armchair/app-core/auth/return-to";
import { takeSilent } from "@armchair/app-core/auth/silent";
import { useAuth } from "@armchair/app-core/auth/use-auth";

import { SECONDARY } from "./ui";

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
      // A silent attempt ("Continue as", or app-core's SsoHandoff) with no
      // Armchair session left (Cognito's login_required): go to Google instead,
      // which signs a returning user straight back in. takeReturn() is left
      // for that second trip.
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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
        <div role="alert" className="flex flex-col gap-4 rounded-3xl border border-magenta/30 bg-night-2 p-6">
          <h1 className="text-2xl font-bold tracking-tight">That sign-in did not finish</h1>
          <p className="text-muted">The link may have expired, or the window sat open too long. Try again.</p>
          <Link href="/" className={`${SECONDARY} self-start`}>
            Back to Armchair Judge
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <ChairLoader className="size-24" label="Signing you in" />
    </main>
  );
}
