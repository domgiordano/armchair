"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { Landing } from "@/components/landing";
import { Loader } from "@/components/loader";
import { rememberReturn } from "@armchair/app-core/auth/return-to";
import { useAuth } from "@armchair/app-core/auth/use-auth";

interface SignedInProps {
  title: string;
  children: ReactNode;
}

/** The app shell once signed in, the landing before. UX only: the API is what refuses a missing token. */
export function SignedIn({ title, children }: SignedInProps) {
  const { status, signInWithGoogle } = useAuth();
  if (status === "signedIn") return <AppShell title={title}>{children}</AppShell>;
  if (status === "loading") return <Loader />;
  return (
    <Landing
      status={status}
      onSignIn={() => {
        rememberReturn();
        return signInWithGoogle();
      }}
    />
  );
}
