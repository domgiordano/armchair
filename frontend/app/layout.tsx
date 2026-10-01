import type { Metadata, Viewport } from "next";
import { Archivo_Black, Poppins } from "next/font/google";

import "./globals.css";

import { SsoHandoff } from "@/components/sso-handoff";

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
    <html lang="en" className={`${poppins.variable} ${archivo.variable} h-full antialiased`}>
      <body className="min-h-full bg-ink font-sans text-pearl">
        <SsoHandoff />
        {children}
      </body>
    </html>
  );
}
