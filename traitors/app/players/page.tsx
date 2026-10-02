import type { Metadata } from "next";

import { PlayersScreen } from "@/components/players-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Players" };

export default function Page() {
  return (
    <SignedIn title="Players">
      <PlayersScreen />
    </SignedIn>
  );
}
