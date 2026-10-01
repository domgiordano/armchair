import type { Metadata } from "next";
import { Suspense } from "react";

import { FriendsRoute } from "@/components/social/friend-link";

export const metadata: Metadata = {
  title: "Friends",
};

// The invite code is a query param, so the static HTML is a fallback until the client renders.
export default function FriendsPage() {
  return (
    <Suspense>
      <FriendsRoute />
    </Suspense>
  );
}
