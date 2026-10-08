import type { Metadata } from "next";
import { Suspense } from "react";

import { StatsScreen } from "@/components/stats/stats-screen";

export const metadata: Metadata = {
  title: "Stats",
};

// The view lives in the query string, so the static HTML is a fallback until the client renders.
export default function StatsPage() {
  return (
    <Suspense>
      <StatsScreen />
    </Suspense>
  );
}
