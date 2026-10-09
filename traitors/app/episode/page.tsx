import type { Metadata } from "next";

import { shareMeta } from "@/lib/share-meta";

import { EpisodeScreen } from "@/components/episode-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = shareMeta(
  "Episode",
  "The round table is waiting · The Traitors",
  "Seal your calls for the murder, the banishment and the recruit.",
);

export default function Page() {
  return (
    <SignedIn title="Episode">
      <EpisodeScreen />
    </SignedIn>
  );
}
