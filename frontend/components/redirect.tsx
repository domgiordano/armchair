"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** A client-side redirect, the only kind a static export can do. */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return null;
}
