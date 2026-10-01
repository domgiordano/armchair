import type { Metadata } from "next";

import { ProfileScreen } from "@/components/account/profile-screen";

export const metadata: Metadata = {
  title: "Profile · Armchair Judge",
  robots: { index: false },
};

export default function ProfilePage() {
  return <ProfileScreen />;
}
