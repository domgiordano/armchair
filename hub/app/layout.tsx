import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";

import "./globals.css";
import "./intro.css";
import "./motion.css";
import "./account.css";

import { SsoHandoff } from "@armchair/app-core/auth/sso-handoff";

import { Backdrop } from "@/components/backdrop";
import { ACCOUNT_HINT_SCRIPT } from "@/lib/account-hint-script";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves the OG image to an absolute URL. Change with the hub's domain_name.
  metadataBase: new URL("https://armchairjudge.com"),
  title: "Armchair Judge",
  description: "Play along with the shows you watch: make your call blind, then see how the show and everyone else called it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#02081e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script below sets data-account before React hydrates.
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCOUNT_HINT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-night font-display text-text">
        <SsoHandoff />
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
