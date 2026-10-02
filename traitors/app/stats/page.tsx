import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Stats" };

export default function Page() {
  return (
    <SignedIn title="Stats">
      <ComingSoon what="Stats" />
    </SignedIn>
  );
}
