import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { PlayerScreen } from "@/components/player-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Player",
  "A player's season · The Traitors",
  "Every player's season: the votes they cast, the votes they drew, and how they left.",
);

export default function Page() {
  return (
    <SignedIn title="Player" seasonless>
      <PlayerScreen />
    </SignedIn>
  );
}
