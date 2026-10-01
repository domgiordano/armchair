import type { Metadata } from "next";

import { LeaderboardsScreen } from "@/components/account/leaderboards-screen";

export const metadata: Metadata = {
  title: "Leaderboards · Armchair Judge",
  robots: { index: false },
};

export default function LeaderboardsPage() {
  return <LeaderboardsScreen />;
}
