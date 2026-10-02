/**
 * Milliseconds until the next episode poll, or null to stop. 10s while the tab
 * is visible during the live window, 60s otherwise: the WAF allows 2000
 * requests per 5 minutes per IP, and a group watching on one Wi-Fi shares an IP.
 */
export function pollInterval(visible: boolean, live: boolean): number | null {
  if (!visible) return null;
  return live ? 10_000 : 60_000;
}
