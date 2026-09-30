"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Landing } from "@/components/landing";
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
  const { status, signInWithGoogle } = useAuth();
  if (status === "signedIn") return <SignedInHome />;
  // Deciding between landing and home takes a moment; don't start the intro for someone signed in.
  if (status === "loading") return null;
  return <Landing status={status} onSignIn={signInWithGoogle} />;
}

function SignedInHome() {
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
    <AppShell title="Overview">
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
          <Link
            href="/episode/"
            className={`${BUTTON} self-start bg-amber-300 text-amber-950 hover:bg-amber-200 active:bg-amber-400`}
          >
            Score the show
          </Link>
        </>
      )}
    </AppShell>
  );
}
