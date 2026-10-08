import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";
import { Suspense } from "react";

import { GroupRoute } from "@/components/groups/group-screen";

export const metadata: Metadata = shareMeta(
  "Group",
  "Our group's leaderboard · Dancing with the Stars",
  "Who in the group scores closest to the judges, dance after dance.",
);

// The group id is a query param, so the static HTML is a fallback until the client renders.
export default function GroupsPage() {
  return (
    <Suspense>
      <GroupRoute />
    </Suspense>
  );
}
