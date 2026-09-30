import type { Metadata } from "next";

import { Credits } from "@/components/credits";

export const metadata: Metadata = {
  title: "Photo credits | Armchair",
};

export default function CreditsPage() {
  return <Credits />;
}
