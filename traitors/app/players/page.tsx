import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Players" };

export default function Page() {
  return (
    <SignedIn title="Players">
      <ComingSoon what="Players" />
    </SignedIn>
  );
}
