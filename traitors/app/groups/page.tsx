import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { GroupsScreen } from "@/components/groups-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Your groups",
  "Our round table · The Traitors",
  "Who in the group reads the castle best, episode after episode.",
);

export default function Page() {
  return (
    <SignedIn title="Your groups" seasonless>
      <GroupsScreen />
    </SignedIn>
  );
}
