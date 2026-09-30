import type { Metadata } from "next";

import { AuthCallback } from "@/components/auth-callback";

export const metadata: Metadata = {
  title: "Signing you in",
};

// A real prerendered route, not a rewrite: the callback URI registered on the
// Cognito app client must be an actual file in the bucket, so the query string
// carrying the authorization code survives.
export default function AuthCallbackPage() {
  return <AuthCallback />;
}
