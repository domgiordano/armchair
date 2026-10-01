"use client";

import { Hub } from "aws-amplify/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DiscoLoader } from "@/components/disco-loader";
import { takeReturn } from "@/lib/auth/return-to";
import { useAuth } from "@/lib/auth/use-auth";

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
      if (payload.event === "signInWithRedirect_failure") setFailed(true);
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
    returnTo.current ??= takeReturn();
    router.replace(returnTo.current);
  }, [status, router]);

  if (failed && status !== "signedIn") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold tracking-tight">That sign-in did not finish</h1>
        <p className="text-neutral-400">
          The link may have expired, or the window sat open too long. Try again.
        </p>
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center rounded-md border border-neutral-600 px-5 font-medium hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:bg-neutral-700"
        >
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6">
      <DiscoLoader size="lg" label="Signing you in" />
      <p aria-hidden="true" className="text-neutral-400">
        Signing you in...
      </p>
    </main>
  );
}
