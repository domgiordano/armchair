import type { Metadata } from "next";

import { JoinScreen } from "@/components/join-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Join a group" };

export default function Page() {
  return (
    <SignedIn title="Join a group" seasonless>
      <JoinScreen />
    </SignedIn>
  );
}
