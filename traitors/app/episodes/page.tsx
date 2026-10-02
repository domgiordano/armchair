import type { Metadata } from "next";

import { EpisodesScreen } from "@/components/episodes-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Episodes" };

export default function Page() {
  return (
    <SignedIn title="Episodes">
      <EpisodesScreen />
    </SignedIn>
  );
}
