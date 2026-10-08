import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Armchair Judge · Dancing with the Stars",
    short_name: "DWTS Judge",
    description: "Score every Dancing with the Stars dance before the judges do.",
    start_url: "/",
    display: "standalone",
    background_color: "#02081e",
    theme_color: "#02081e",
    icons: [
      { src: "/brand/dwts-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/dwts-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
