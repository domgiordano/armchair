import type { Metadata } from "next";

import { Redirect } from "@/components/redirect";

export const metadata: Metadata = {
  title: "Groups",
};

// Groups moved into Friends & Groups; old links and bookmarks land there.
export default function GroupsPage() {
  return <Redirect to="/friends/?tab=groups" />;
}
