import type { Metadata } from "next";
import { Suspense } from "react";

import { LeaderboardScreen } from "@/components/leaderboard-screen";

export const metadata: Metadata = {
  title: "Leaderboard",
};

// useSearchParams has no value at export time, so the board renders on the client.
export default function LeaderboardPage() {
  return (
    <Suspense>
      <LeaderboardScreen />
    </Suspense>
  );
}
