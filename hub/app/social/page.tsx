import type { Metadata } from "next";

import { SocialScreen } from "@/components/account/social-screen";

export const metadata: Metadata = {
  title: "Social · Armchair Judge",
  robots: { index: false },
};

export default function SocialPage() {
  return <SocialScreen />;
}
