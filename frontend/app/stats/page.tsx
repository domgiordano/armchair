import type { Metadata } from "next";

import { StatsScreen } from "@/components/stats-screen";

export const metadata: Metadata = {
  title: "Accuracy",
};

export default function StatsPage() {
  return <StatsScreen />;
}
