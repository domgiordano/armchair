import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { LeaderboardScreen } from "@/components/leaderboard-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Leaderboard",
  "Who saw it coming · The Traitors",
  "The season's standings: points for every call that came true.",
);

export default function Page() {
  return (
    <SignedIn title="Leaderboard">
      <LeaderboardScreen />
    </SignedIn>
  );
}
