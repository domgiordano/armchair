import type { Metadata } from "next";
import { Suspense } from "react";

import { JoinScreen } from "@/components/join";

export const metadata: Metadata = {
  title: "Join a group",
};

// The code is a query param, so the static HTML is a fallback until the client renders.
export default function JoinPage() {
  return (
    <Suspense>
      <JoinScreen />
    </Suspense>
  );
}
