import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export to S3 + CloudFront, like frontend/.
  output: "export",

  // Emits /page/index.html instead of /page.html, the shape the web-hosting
  // module's subroute rewrite expects.
  trailingSlash: true,

  images: {
    // next/image's optimizer needs a running server; a static export has none.
    unoptimized: true,
  },
};

export default nextConfig;
