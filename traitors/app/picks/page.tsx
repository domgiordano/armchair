import type { Metadata } from "next";

import { PicksScreen } from "@/components/picks-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Picks" };

export default function Page() {
  return (
    <SignedIn title="Picks">
      <PicksScreen />
    </SignedIn>
  );
}
