/**
 * Who last signed in on this browser, in a cookie on the parent domain so the
 * hub and every show app can read it. Only a display name and photo URL: it
 * labels the one-tap "Continue as" button, it never signs anyone in.
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

/** The raw cookie value: a stable string, so it can be a useSyncExternalStore snapshot. */
export function rawWho(): string | null {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${NAME}=`))
      ?.slice(NAME.length + 1) || null
  );
}

export function parseWho(raw: string | null): Who | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value !== "object" || value === null) return null;
    const { name, picture } = value as Record<string, unknown>;
    if (typeof name !== "string" || !name) return null;
    return { name, picture: typeof picture === "string" ? picture : null };
  } catch {
    // Someone else's or a mangled cookie: treat it as absent.
    return null;
  }
}

export function writeWho(who: Who): void {
  const value = encodeURIComponent(JSON.stringify(who));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NAME}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${domain()}${secure}`;
}

export function clearWho(): void {
  document.cookie = `${NAME}=; Path=/; Max-Age=0; SameSite=Lax${domain()}`;
}
