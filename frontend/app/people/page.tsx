import type { Metadata } from "next";

import { PersonScreen } from "@/components/people/person-screen";

export const metadata: Metadata = {
  title: "Stars, pros and judges",
};

export default function PeoplePage() {
  return <PersonScreen />;
}
