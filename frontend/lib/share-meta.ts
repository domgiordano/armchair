import type { Metadata } from "next";

export const SITE_NAME = "Armchair Judge · Dancing with the Stars";

/**
 * A route's tab title plus what its link preview says. A child's openGraph
 * replaces the layout's whole, so the site name is restated here. The image is
 * the route's own opengraph-image.jpg.
 */
export function shareMeta(title: string, preview: string, description: string): Metadata {
  return {
    title,
    openGraph: { type: "website", siteName: SITE_NAME, title: preview, description },
    twitter: { card: "summary_large_image", title: preview, description },
  };
}
