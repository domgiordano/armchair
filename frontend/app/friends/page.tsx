import type { Metadata } from "next";
import { Suspense } from "react";

import { FriendsScreen } from "@/components/friends/friends-screen";

export const metadata: Metadata = {
  title: "Friends & Groups",
};

// The tab, group and invite code are query params, so the static HTML is a fallback until the client renders.
export default function FriendsPage() {
  return (
    <Suspense>
      <FriendsScreen />
    </Suspense>
  );
}
