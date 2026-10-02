"use client";

import { useSyncExternalStore } from "react";

import { AppShell } from "@/components/app-shell";
import { Landing } from "@/components/landing";
import { Overview } from "@/components/overview";
import { likelySignedIn } from "@armchair/app-core/auth/session-hint";
import { useAuth } from "@armchair/app-core/auth/use-auth";

const noSubscribe = () => () => {};

/**
 * THIS IS UX, NOT SECURITY. The site is a static export, so anyone can read the
 * bundle. Private data comes only from Cognito-authorized API endpoints.
 */
export function Home() {
  const { status, signInWithGoogle } = useAuth();
  // False on the server, so the static HTML opens on the intro's load-in stage.
  const returning = useSyncExternalStore(noSubscribe, likelySignedIn, () => false);
  if (status === "signedIn") {
    return (
      <AppShell title="Overview" wide>
        <Overview />
      </AppShell>
    );
  }
  // Deciding between landing and home takes a moment; don't start the intro for someone likely signed in.
  if (status === "loading" && returning) return null;
  return <Landing status={status} onSignIn={signInWithGoogle} />;
}
