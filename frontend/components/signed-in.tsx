"use client";

import type { ReactNode } from "react";
import { GoogleMark } from "@/components/google-mark";

import { AppShell } from "@/components/app-shell";
import { Brand } from "@/components/brand";
import { PageLoader } from "@/components/disco-loader";
import { Specks } from "@/components/ui/specks";
import { rememberReturn } from "@/lib/auth/return-to";
import { useAuth } from "@/lib/auth/use-auth";
import { DISPLAY, PRIMARY } from "@/lib/ui";

interface SignedInProps {
  title: string;
  wide?: boolean;
  children: ReactNode;
}

/** The app shell once signed in, a sign-in wall before. UX only: the API is what refuses a missing token. */
export function SignedIn({ title, wide = false, children }: SignedInProps) {
  const { status, signInWithGoogle } = useAuth();

  if (status === "signedIn") {
    return (
      <AppShell title={title} wide={wide}>
        {children}
      </AppShell>
    );
  }

  return (
    <div className="relative isolate mx-auto flex min-h-dvh max-w-md flex-col">
      <Specks />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgb(59_91_255/0.18),transparent_70%)]"
      />
      <header className="flex items-center justify-between gap-3 border-b border-silver/10 px-4 py-2">
        <Brand />
        <span className="text-sm text-silver-dim">{title}</span>
      </header>
      <main aria-live="polite" className="flex flex-1 flex-col justify-center gap-4 px-6 py-10">
        {status === "loading" && <PageLoader />}
        {status === "unconfigured" && <p className="text-silver-dim">Sign-in is not configured in this build.</p>}
        {status === "signedOut" && (
          <div className="flex flex-col gap-5 rounded-2xl border border-gold/25 bg-ballroom/60 p-6 shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] animate-pop-in">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Dancing with the Stars</p>
            <h1 className={`${DISPLAY} text-4xl leading-none`}>
              <span className="text-chrome">take your seat.</span>
            </h1>
            <p className="text-silver-dim">Sign in to see this page.</p>
            <button
              type="button"
              onClick={() => {
                rememberReturn();
                void signInWithGoogle();
              }}
              className={`${PRIMARY} self-start`}
            >
              <span className="inline-flex items-center gap-2.5">
                <GoogleMark />
                Sign in with Google
              </span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
