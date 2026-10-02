const KEY = "armchair.returnTo";

/** Remembers the page a sign-in started from, so an invite link survives the Google round trip. */
export function rememberReturn(): void {
  try {
    window.sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
  } catch {
    // Storage disabled: sign-in lands on the home page instead.
  }
}

export function takeReturn(): string {
  let path: string | null = null;
  try {
    path = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    // As above.
  }
  // Same-origin paths only; "//host" would be a protocol-relative redirect.
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
}
