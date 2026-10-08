import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";
import { Suspense } from "react";

import { LeaderboardScreen } from "@/components/leaderboard-screen";

export const metadata: Metadata = shareMeta(
  "Leaderboard",
  "Who's closest to the judges · Dancing with the Stars",
  "The season leaderboard: lowest average gap to the panel wins.",
);

// useSearchParams has no value at export time, so the board renders on the client.
export default function LeaderboardPage() {
  return (
    <Suspense>
      <LeaderboardScreen />
    </Suspense>
  );
}
