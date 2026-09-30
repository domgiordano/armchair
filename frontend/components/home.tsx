"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { VotePanel } from "@/components/vote-panel";
import { getMe, type Me } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/use-auth";

const BUTTON =
  "flex min-h-11 items-center justify-center rounded-md px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50";

type MeState = { kind: "loading" } | { kind: "ready"; me: Me } | { kind: "error"; message: string };

/**
 * THIS IS UX, NOT SECURITY. The site is a static export, so anyone can read the
 * bundle. Private data comes only from Cognito-authorized API endpoints.
 */
export function Home() {
  const { status, signInWithGoogle, signOut } = useAuth();
  if (status === "signedIn") return <SignedInHome onSignOut={signOut} />;
  return <Landing status={status} onSignIn={signInWithGoogle} />;
}

interface LandingProps {
  status: "loading" | "signedOut" | "unconfigured";
  onSignIn: () => Promise<void>;
}

function Landing({ status, onSignIn }: LandingProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(false);

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Armchair</h1>
        <p className="text-neutral-400">
          Score each Dancing with the Stars performance 1 to 10, then see how the judges scored it.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void start()}
        disabled={status !== "signedOut" || redirecting}
        className={`${BUTTON} bg-amber-300 text-amber-950 hover:bg-amber-200 active:bg-amber-400`}
      >
        {redirecting ? "Opening Google..." : "Sign in with Google"}
      </button>
      <div aria-live="polite" className="text-sm text-neutral-400">
        {status === "unconfigured" && "Sign-in is not configured in this build."}
        {error && "Could not start sign-in. Try again."}
      </div>
    </main>
  );
}

interface SignedInHomeProps {
  onSignOut: () => Promise<void>;
}

function SignedInHome({ onSignOut }: SignedInHomeProps) {
  const [state, setState] = useState<MeState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMe().then(
      (me) => !cancelled && setState({ kind: "ready", me }),
      (e: unknown) =>
        !cancelled &&
        setState({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-6 py-3">
        <span className="text-lg font-semibold tracking-tight">Armchair</span>
        <div className="flex items-center gap-2">
          {state.kind === "ready" && (
            <Avatar name={state.me.name} email={state.me.email} picture={state.me.picture} />
          )}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className={`${BUTTON} text-neutral-300 hover:bg-neutral-800 active:bg-neutral-700`}
          >
            Sign out
          </button>
        </div>
      </header>
      <main aria-live="polite" className="flex flex-1 flex-col gap-4 px-6 py-8">
        {state.kind === "loading" && <p className="text-neutral-400">Loading your profile...</p>}
        {state.kind === "error" && (
          <>
            <p>Could not load your profile: {state.message}</p>
            <button
              type="button"
              onClick={retry}
              className={`${BUTTON} self-start border border-neutral-600 hover:bg-neutral-800 active:bg-neutral-700`}
            >
              Try again
            </button>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              Hi, {state.me.name ?? state.me.email}
            </h1>
            <p className="text-neutral-400">The episode scorecard shows up here once the next show is loaded.</p>
            <VotePanel />
          </>
        )}
      </main>
    </div>
  );
}
