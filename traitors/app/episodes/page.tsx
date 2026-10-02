import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Episodes" };

export default function Page() {
  return (
    <SignedIn title="Episodes">
      <ComingSoon what="Episodes" />
    </SignedIn>
  );
}
