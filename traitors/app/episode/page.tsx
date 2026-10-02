import type { Metadata } from "next";

import { EpisodeScreen } from "@/components/episode-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Episode" };

export default function Page() {
  return (
    <SignedIn title="Episode">
      <EpisodeScreen />
    </SignedIn>
  );
}
