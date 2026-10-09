import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { PicksScreen } from "@/components/picks-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Picks",
  "My calls · The Traitors",
  "Every call I made this season, and what each one scored.",
);

export default function Page() {
  return (
    <SignedIn title="Picks">
      <PicksScreen />
    </SignedIn>
  );
}
