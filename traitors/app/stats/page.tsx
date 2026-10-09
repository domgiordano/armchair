import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { StatsScreen } from "@/components/stats-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Stats",
  "My ledger · The Traitors",
  "Your points by call and by episode, all season long.",
);

export default function Page() {
  return (
    <SignedIn title="Stats">
      <StatsScreen />
    </SignedIn>
  );
}
