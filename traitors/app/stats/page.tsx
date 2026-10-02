import type { Metadata } from "next";

import { StatsScreen } from "@/components/stats-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Stats" };

export default function Page() {
  return (
    <SignedIn title="Stats">
      <StatsScreen />
    </SignedIn>
  );
}
