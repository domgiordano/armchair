import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/*" alias from tsconfig.json natively -- no plugin needed.
    tsconfigPaths: true,
    // @armchair/app-core resolves to ../packages/app-core, which has no
    // node_modules: its bare imports must come from this app, as one copy.
    dedupe: ["react", "react-dom", "aws-amplify", "vitest"],
  },
  // Lets vitest load the package's own test files from outside this root.
  server: { fs: { allow: [".", "../packages/app-core"] } },
  test: {
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}", "../packages/app-core/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
