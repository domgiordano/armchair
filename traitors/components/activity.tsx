"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { startActivity, track } from "@armchair/app-core/activity/track";

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => startActivity("traitors"), []);
  useEffect(() => track("view", "page"), [pathname, search]);
  return null;
}

/** First-party page views and actions (docs/architecture/activity.md). */
export function Activity() {
  // useSearchParams needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  );
}
