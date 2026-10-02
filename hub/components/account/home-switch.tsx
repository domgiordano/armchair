"use client";

import { useEffect, type ReactNode } from "react";

import { clearAccountHint, useAccountHint } from "@/lib/account-hint";
import { useAuth } from "@armchair/app-core/auth/use-auth";

import { Dashboard } from "./dashboard";

/**
 * The landing for visitors, the dashboard for members. While the session is
 * being read, a browser that has held one shows the boot loader (app/page.tsx)
 * instead of starting the intro.
 */
export function HomeSwitch({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const hinted = useAccountHint();

  useEffect(() => {
    if (status !== "loading") clearAccountHint();
  }, [status]);

  if (status === "signedIn") return <Dashboard />;
  if (status === "loading" && hinted) return null;
  return children;
}
