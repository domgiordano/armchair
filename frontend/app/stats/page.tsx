import type { Metadata } from "next";

import { StatsScreen } from "@/components/stats-screen";

export const metadata: Metadata = {
  title: "Accuracy | Armchair",
};

export default function StatsPage() {
  return <StatsScreen />;
}
