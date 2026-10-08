import type { Metadata } from "next";

import { SettingsScreen } from "@/components/settings-screen";
import { SignedIn } from "@/components/signed-in";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <SignedIn title="Settings" seasonless>
      <SettingsScreen />
    </SignedIn>
  );
}
