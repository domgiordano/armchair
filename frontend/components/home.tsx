"use client";

import { AppShell } from "@/components/app-shell";
import { Landing } from "@/components/landing";
import { Overview } from "@/components/overview";
import { useAuth } from "@/lib/auth/use-auth";

/**
 * THIS IS UX, NOT SECURITY. The site is a static export, so anyone can read the
 * bundle. Private data comes only from Cognito-authorized API endpoints.
 */
export function Home() {
  const { status, signInWithGoogle } = useAuth();
  if (status === "signedIn") {
    return (
      <AppShell title="Overview" wide>
        <Overview />
      </AppShell>
    );
  }
  // Deciding between landing and home takes a moment; don't start the intro for someone signed in.
  if (status === "loading") return null;
  return <Landing status={status} onSignIn={signInWithGoogle} />;
}
