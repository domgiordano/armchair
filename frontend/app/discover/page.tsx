import type { Metadata } from "next";

import { DiscoverScreen } from "@/components/discover-screen";

export const metadata: Metadata = {
  title: "Discover",
};

export default function DiscoverPage() {
  return <DiscoverScreen />;
}
