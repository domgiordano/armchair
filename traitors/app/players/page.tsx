import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { PlayersScreen } from "@/components/players-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Players",
  "The players · The Traitors",
  "Every player's season: the votes they cast, the votes they drew, and how they left.",
);

export default function Page() {
  return (
    <SignedIn title="Players">
      <PlayersScreen />
    </SignedIn>
  );
}
