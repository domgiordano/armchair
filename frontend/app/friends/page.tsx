import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";
import { Suspense } from "react";

import { FriendsRoute } from "@/components/social/friend-link";

export const metadata: Metadata = shareMeta(
  "Friends",
  "Add me on Armchair Judge · Dancing with the Stars",
  "We each score every dance, then see who lands closer to the judges.",
);

// The invite code is a query param, so the static HTML is a fallback until the client renders.
export default function FriendsPage() {
  return (
    <Suspense>
      <FriendsRoute />
    </Suspense>
  );
}
