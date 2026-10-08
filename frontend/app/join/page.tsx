import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";
import { Suspense } from "react";

import { JoinScreen } from "@/components/join";

export const metadata: Metadata = shareMeta(
  "Join a group",
  "Join my group · Dancing with the Stars",
  "Score every Dancing with the Stars dance together, then see who called it closest.",
);

// The code is a query param, so the static HTML is a fallback until the client renders.
export default function JoinPage() {
  return (
    <Suspense>
      <JoinScreen />
    </Suspense>
  );
}
