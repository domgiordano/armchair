import { APPS, appLink } from "@armchair/app-core/apps";

// Both shows are live, so appLink always has a URL for them; "/" only satisfies the type.
export const dwtsLink = (path = "/", params: Record<string, string> = {}) => appLink("dwts", path, params) ?? "/";

export const traitorsLink = (path = "/", params: Record<string, string> = {}) => appLink("traitors", path, params) ?? "/";

/** Someone's profile. The hub has no page for other people yet, so it's DWTS's. */
export const profileLink = (sub: string) => dwtsLink("/profile/", { u: sub });

// Shared with someone else, so no sso=1: a stranger opening it shouldn't be bounced through Google.
const DWTS_URL = APPS.find((a) => a.id === "dwts")?.url;
export const friendInviteLink = (code: string) => `${DWTS_URL}/friends/?add=${encodeURIComponent(code)}`;

export const GITHUB_URL = "https://github.com/domgiordano/armchair";
export const XOMWARE_URL = "https://xomware.com";
