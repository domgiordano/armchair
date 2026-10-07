import type { Metadata } from "next";

import { SocialScreen } from "@/components/social/social-screen";

export const metadata: Metadata = {
  title: "Friends & Groups",
};

export default function SocialPage() {
  return <SocialScreen />;
}
