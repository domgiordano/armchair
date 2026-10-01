import type { Metadata } from "next";

import { StatsScreen } from "@/components/account/stats-screen";

export const metadata: Metadata = {
  title: "Stats · Armchair Judge",
  robots: { index: false },
};

export default function StatsPage() {
  return <StatsScreen />;
}
