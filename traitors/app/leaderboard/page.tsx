import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Leaderboard" };

export default function Page() {
  return (
    <SignedIn title="Leaderboard">
      <ComingSoon what="Leaderboard" />
    </SignedIn>
  );
}
