import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";

import "./globals.css";
import "./intro.css";
import "./motion.css";

import { Backdrop } from "@/components/backdrop";

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
  description: "Score the show like a judge from your couch, then see how the real panel and everyone else scored it.",
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
      <body className="min-h-full bg-night font-display text-text">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
