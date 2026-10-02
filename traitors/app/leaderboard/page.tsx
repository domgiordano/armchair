import type { Metadata } from "next";

import { LeaderboardScreen } from "@/components/leaderboard-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Leaderboard" };

export default function Page() {
  return (
    <SignedIn title="Leaderboard">
      <LeaderboardScreen />
    </SignedIn>
  );
}
