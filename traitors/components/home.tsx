"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import { useEffect, useState, useSyncExternalStore } from "react";

import { GoogleMark } from "@/components/google-mark";
import { BUTTON } from "@/lib/ui";
import { likelySignedIn } from "@armchair/app-core/auth/session-hint";
import { useAuth } from "@armchair/app-core/auth/use-auth";

const noSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * THIS IS UX, NOT SECURITY. The site is a static export, so anyone can read the
 * bundle. Private data comes only from Cognito-authorized API endpoints.
 */
export function Home() {
  const { status, signInWithGoogle } = useAuth();
  // False on the server, so the static HTML is the landing.
  const returning = useSyncExternalStore(noSubscribe, likelySignedIn, onServer);
  const hydrated = useSyncExternalStore(noSubscribe, onClient, onServer);
  if (status === "signedIn") return <SignedIn />;
  if (status === "loading" && returning) return null;
  return <Landing status={status} onSignIn={signInWithGoogle} prerendered={!hydrated} />;
}

interface LandingProps {
  status: "loading" | "signedOut" | "unconfigured";
  onSignIn: () => Promise<void>;
  prerendered: boolean;
}

function Landing({ status, onSignIn, prerendered }: LandingProps) {
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
    <div data-prerendered={prerendered ? "" : undefined} className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <h1 className="font-title text-6xl font-bold text-bone sm:text-7xl">Traitors</h1>
        <p className="text-lg leading-relaxed">
          Call the banishments and the murders before the round table does.
        </p>
        <button type="button" onClick={() => void start()} disabled={status !== "signedOut" || redirecting} className={BUTTON}>
          <GoogleMark />
          {redirecting ? "Opening Google..." : "Sign in with Google"}
        </button>
        <div aria-live="polite" className="min-h-6 text-ash">
          {status === "unconfigured" && "Sign-in is not configured in this build."}
          {error && "Could not start sign-in. Try again."}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
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
