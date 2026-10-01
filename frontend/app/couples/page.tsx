import type { Metadata } from "next";

import { CouplesScreen } from "@/components/couples-screen";

export const metadata: Metadata = {
  title: "Couples",
};

export default function CouplesPage() {
  return <CouplesScreen />;
}
