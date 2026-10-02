"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Landing } from "@/components/landing";
import { likelySignedIn } from "@armchair/app-core/auth/session-hint";
import { useAuth } from "@armchair/app-core/auth/use-auth";

const noSubscribe = () => () => {};
const onServer = () => false;

/**
 * THIS IS UX, NOT SECURITY. The site is a static export, so anyone can read the
 * bundle. Private data comes only from Cognito-authorized API endpoints.
 */
export function Home() {
  const { status } = useAuth();
  // False on the server, so the static HTML opens on the intro.
  const returning = useSyncExternalStore(noSubscribe, likelySignedIn, onServer);
  if (status === "signedIn") return <SignedIn />;
  if (status === "loading" && returning) return null;
  return <Landing />;
}

function SignedIn() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAuthSession().then((session) => {
      const claims = session.tokens?.idToken?.payload;
      const value = claims?.name ?? claims?.email;
      if (!cancelled && typeof value === "string") setName(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl tracking-[0.12em] text-bone uppercase">The Traitors</h1>
        <p aria-live="polite" className="text-lg">
          {name ? `Signed in as ${name}` : "Signed in"}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-cloak px-6 py-5 text-center text-sm text-ash">
      Not affiliated with The Traitors, BBC, NBC or Peacock.
    </footer>
  );
}
