import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { JoinScreen } from "@/components/join-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Join a group",
  "Join my group · The Traitors",
  "Call The Traitors with the group, episode by episode, then see who saw it coming.",
);

export default function Page() {
  return (
    <SignedIn title="Join a group" seasonless>
      <JoinScreen />
    </SignedIn>
  );
}
