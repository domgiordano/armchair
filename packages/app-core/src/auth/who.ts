/**
 * Who last signed in on this browser, in a cookie on the parent domain that
 * the hub (armchairjudge.com) reads to offer a one-tap "Continue as". The hub's
 * hub/lib/auth/who.ts reads and writes the same cookie; keep the two in step.
 */
export interface Who {
  name: string;
  picture: string | null;
}

const NAME = "armchair_who";
const MAX_AGE = 30 * 24 * 60 * 60; // The refresh token's lifetime.

// Shared across subdomains in production; host-only on localhost, where a
// Domain attribute would make the browser drop the cookie.
function domain(): string {
  const host = window.location.hostname;
  return host === "armchairjudge.com" || host.endsWith(".armchairjudge.com") ? "; Domain=armchairjudge.com" : "";
}

export function writeWho(who: Who): void {
  const value = encodeURIComponent(JSON.stringify(who));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NAME}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${domain()}${secure}`;
}

export function clearWho(): void {
  document.cookie = `${NAME}=; Path=/; Max-Age=0; SameSite=Lax${domain()}`;
}
