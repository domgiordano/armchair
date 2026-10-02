import type { Metadata } from "next";

import { CoupleScreen } from "@/components/couple/couple-screen";

export const metadata: Metadata = {
  title: "Couple",
};

export default function CouplePage() {
  return <CoupleScreen />;
}
