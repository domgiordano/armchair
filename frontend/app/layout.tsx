import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves the Open Graph image to an absolute URL for link previews.
  metadataBase: new URL("https://dwts.armchairjudge.com"),
  title: {
    default: "Armchair Judge · Dancing with the Stars",
    template: "%s · Armchair Judge",
  },
  description: "Score Dancing with the Stars like a judge, blind until you answer.",
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
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-ink font-sans text-neutral-100">{children}</body>
    </html>
  );
}
