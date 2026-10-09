import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Armchair Judge · The Traitors",
    short_name: "Traitors Judge",
    description: "Call the murders and banishments on The Traitors before the round table does.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0d0b",
    theme_color: "#0a0d0b",
    icons: [
      { src: "/brand/traitors-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/traitors-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
