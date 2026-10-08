import type { Metadata } from "next";

import { GroupsScreen } from "@/components/groups-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Your groups" };

export default function Page() {
  return (
    <SignedIn title="Your groups" seasonless>
      <GroupsScreen />
    </SignedIn>
  );
}
