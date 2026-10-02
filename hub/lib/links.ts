export const DWTS_URL = "https://dwts.armchairjudge.com";
export const TRAITORS_URL = "https://traitors.armchairjudge.com";

/**
 * An app page that opens signed in: `sso=1` tells the app to resume the
 * Armchair session silently when it has none of its own.
 */
const signedIn = (base: string, path: string, params: Record<string, string>) =>
  `${base}${path}?${new URLSearchParams({ ...params, sso: "1" })}`;

export const dwtsLink = (path = "/", params: Record<string, string> = {}) => signedIn(DWTS_URL, path, params);

export const traitorsLink = (path = "/", params: Record<string, string> = {}) => signedIn(TRAITORS_URL, path, params);

/** Someone's profile. The hub has no page for other people yet, so it's DWTS's. */
export const profileLink = (sub: string) => dwtsLink("/profile/", { u: sub });

export const friendInviteLink = (code: string) => `${DWTS_URL}/friends/?add=${encodeURIComponent(code)}`;

export const GITHUB_URL = "https://github.com/domgiordano/armchair";
export const XOMWARE_URL = "https://xomware.com";
