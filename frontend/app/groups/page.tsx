import type { Metadata } from "next";

import { GroupsScreen } from "@/components/groups";

export const metadata: Metadata = {
  title: "Groups",
};

export default function GroupsPage() {
  return <GroupsScreen />;
}
