"use client";

import { useState, useSyncExternalStore } from "react";

import { GoogleMark } from "@/components/google-mark";
import { BUTTON } from "@/lib/ui";

const noSubscribe = () => () => {};

interface LandingProps {
  status: "loading" | "signedOut" | "unconfigured";
  onSignIn: () => Promise<void>;
}

/** Placeholder until the intro and landing land; that work replaces this file. */
export function Landing({ status, onSignIn }: LandingProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(false);
  // True only in the static HTML, which the session hint hides from returning users.
  const prerendered = useSyncExternalStore(noSubscribe, () => false, () => true);

  const start = async () => {
    setRedirecting(true);
    setError(false);
    try {
      await onSignIn();
    } catch {
      setRedirecting(false);
      setError(true);
    }
  };

  return (
    <div data-prerendered={prerendered ? "" : undefined} className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <h1 className="font-title text-6xl font-bold text-bone sm:text-7xl">Traitors</h1>
        <p className="text-lg leading-relaxed">Call the banishments and the murders before the round table does.</p>
        <button type="button" onClick={() => void start()} disabled={status !== "signedOut" || redirecting} className={BUTTON}>
          <GoogleMark />
          {redirecting ? "Opening Google..." : "Sign in with Google"}
        </button>
        <div aria-live="polite" className="min-h-6 text-ash">
          {status === "unconfigured" && "Sign-in is not configured in this build."}
          {error && "Could not start sign-in. Try again."}
        </div>
      </main>
      <footer className="border-t border-cloak px-6 py-5 text-center text-sm text-ash">
        Not affiliated with The Traitors, BBC, NBC or Peacock.
      </footer>
    </div>
  );
}
