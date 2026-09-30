import type { Metadata } from "next";
import { Suspense } from "react";

import { EpisodeScreen } from "@/components/episode-screen";

export const metadata: Metadata = {
  title: "Scorecard | Armchair",
};

// useSearchParams has no value at export time, so the static HTML is the
// fallback and the episode renders on the client.
export default function EpisodePage() {
  return (
    <Suspense>
      <EpisodeScreen />
    </Suspense>
  );
}
