import type { Metadata } from "next";

import { PlayerScreen } from "@/components/player-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Player" };

export default function Page() {
  return (
    <SignedIn title="Player" seasonless>
      <PlayerScreen />
    </SignedIn>
  );
}
