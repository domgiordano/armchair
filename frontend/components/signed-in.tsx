"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth/use-auth";
import { PRIMARY } from "@/lib/ui";

interface SignedInProps {
  title: string;
  children: ReactNode;
}

/** Page chrome plus the sign-in wall. UX only: the API is what refuses a missing token. */
export function SignedIn({ title, children }: SignedInProps) {
  const { status, signInWithGoogle } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <Link
          href="/"
          className="rounded-md text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Armchair
        </Link>
        <span className="text-sm text-neutral-400">{title}</span>
      </header>
      <main aria-live="polite" className="flex flex-1 flex-col gap-4 px-4 py-6">
        {status === "loading" && <p className="text-neutral-400">Loading...</p>}
        {status === "unconfigured" && (
          <p className="text-neutral-400">Sign-in is not configured in this build.</p>
        )}
        {status === "signedOut" && (
          <>
            <p>Sign in to see this page.</p>
            <button type="button" onClick={() => void signInWithGoogle()} className={`${PRIMARY} self-start`}>
              Sign in with Google
            </button>
          </>
        )}
        {status === "signedIn" && children}
      </main>
    </div>
  );
}
