import type { Metadata } from "next";
import { Suspense } from "react";

import { GroupRoute } from "@/components/groups/group-screen";

export const metadata: Metadata = {
  title: "Group",
};

// The group id is a query param, so the static HTML is a fallback until the client renders.
export default function GroupsPage() {
  return (
    <Suspense>
      <GroupRoute />
    </Suspense>
  );
}
