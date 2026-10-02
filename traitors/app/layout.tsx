import type { Metadata, Viewport } from "next";
import { Caveat, Cinzel, Cinzel_Decorative, EB_Garamond } from "next/font/google";

import { SESSION_HINT_SCRIPT } from "@armchair/app-core/auth/session-hint";

import "./globals.css";

import { SsoHandoff } from "@/components/sso-handoff";

const garamond = EB_Garamond({ subsets: ["latin"], variable: "--font-garamond", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap" });
const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-cinzel-decorative",
  display: "swap",
});
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://traitors.armchairjudge.com"),
  title: {
    default: "Armchair Judge · The Traitors",
    template: "%s · Armchair Judge",
  },
  description: "Call the banishments and murders on The Traitors before the round table does.",
  // A friends-only app: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0d0b",
};

const FONTS = [garamond, cinzel, cinzelDecorative, caveat].map((f) => f.variable).join(" ");

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script marks <html data-session> before hydration.
    <html lang="en" className={`${FONTS} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SESSION_HINT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-night font-serif text-parchment">
        <SsoHandoff />
        {children}
      </body>
    </html>
  );
}
