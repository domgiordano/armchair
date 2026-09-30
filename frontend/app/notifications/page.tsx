import type { Metadata } from "next";

import { NotificationsScreen } from "@/components/notifications";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
