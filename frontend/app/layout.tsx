import type { Metadata, Viewport } from "next";
import { Archivo_Black, Poppins } from "next/font/google";

import { SESSION_HINT_SCRIPT } from "@armchair/app-core/auth/session-hint";

import { SITE_NAME } from "@/lib/share-meta";

import "./globals.css";

import { SsoHandoff } from "@armchair/app-core/auth/sso-handoff";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

// Our chrome page headings, on every page.
const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves the Open Graph image to an absolute URL for link previews.
  metadataBase: new URL("https://dwts.armchairjudge.com"),
  title: {
    default: "Dancing with the Stars · Armchair Judge",
    template: "%s · DWTS · Armchair Judge",
  },
  description: "Score every Dancing with the Stars dance before the judges do, then see how close you came.",
  applicationName: "Armchair Judge · DWTS",
  // Each route's card is its own opengraph-image.jpg, rendered by scripts/og/render.mjs.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Dancing with the Stars · Armchair Judge",
    description: "Score every dance before the judges do, then see how close you came.",
  },
  twitter: { card: "summary_large_image" },
  // A friends-only app: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#02081e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script marks <html data-session> before hydration.
    <html lang="en" className={`${poppins.variable} ${archivo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SESSION_HINT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-ink font-sans text-pearl">
        <SsoHandoff />
        {children}
      </body>
    </html>
  );
}
