export const DWTS_URL = "https://dwts.armchairjudge.com";

/**
 * A DWTS page that opens signed in: `sso=1` tells the app to resume the
 * Armchair session silently when it has none of its own.
 */
export function dwtsLink(path = "/", params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ ...params, sso: "1" });
  return `${DWTS_URL}${path}?${query}`;
}

/** Someone's profile. The hub has no page for other people yet, so it's DWTS's. */
export const profileLink = (sub: string) => dwtsLink("/profile/", { u: sub });

export const friendInviteLink = (code: string) => `${DWTS_URL}/friends/?add=${encodeURIComponent(code)}`;
