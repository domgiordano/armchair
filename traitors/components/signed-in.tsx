"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { Landing } from "@/components/landing";
import { Loader } from "@/components/loader";
import { useAuth } from "@armchair/app-core/auth/use-auth";

interface SignedInProps {
  title: string;
  seasonless?: boolean;
  children: ReactNode;
}

/** The app shell once signed in, the landing before. UX only: the API is what refuses a missing token. */
export function SignedIn({ title, seasonless, children }: SignedInProps) {
  const { status } = useAuth();
  if (status === "signedIn") {
    return (
      <AppShell title={title} seasonless={seasonless}>
        {children}
      </AppShell>
    );
  }
  if (status === "loading") return <Loader />;
  return <Landing />;
}
