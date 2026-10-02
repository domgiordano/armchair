import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @armchair/app-core is a symlink to ../packages/app-core, shipped as source.
  // Turbopack won't follow a link that leaves its root, so the root is the repo.
  // The package has no node_modules of its own; the alias points its Amplify
  // imports at this app's copy, since a second copy would never be configured.
  transpilePackages: ["@armchair/app-core"],
  turbopack: {
    root: path.join(__dirname, ".."),
    resolveAlias: {
      "aws-amplify": "./node_modules/aws-amplify",
      "aws-amplify/*": "./node_modules/aws-amplify/*",
    },
  },

  // Static export to S3 + CloudFront, like frontend/ and hub/.
  output: "export",

  // Emits /auth/callback/index.html instead of /auth/callback.html, the shape
  // the web-hosting module's subroute rewrite expects.
  trailingSlash: true,

  images: {
    // next/image's optimizer needs a running server; a static export has none.
    unoptimized: true,
  },
};

export default nextConfig;
