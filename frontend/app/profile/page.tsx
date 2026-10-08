import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { ProfileScreen } from "@/components/profile-screen";

export const metadata: Metadata = shareMeta(
  "Profile",
  "How I score · Dancing with the Stars",
  "My paddles against the judges, all season long.",
);

export default function ProfilePage() {
  return <ProfileScreen />;
}
