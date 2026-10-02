// A cookie every Armchair site can read (Domain=.armchairjudge.com) that says someone is
// signed in on one of them. Tokens stay per-site in localStorage; this only tells a site
// with no session of its own that a silent prompt=none sign-in will succeed. It carries
// no identity. Local hosts (localhost, previews) never set it.

const NAME = "armchair_signed_in";
const DOMAIN = "armchairjudge.com";
const MONTH = 30 * 24 * 3600;

const onFamilyHost = () => window.location.hostname === DOMAIN || window.location.hostname.endsWith(`.${DOMAIN}`);

function write(value: string, maxAge: number): void {
  if (!onFamilyHost()) return;
  document.cookie = `${NAME}=${value}; Domain=.${DOMAIN}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

export const markFamilySignedIn = () => write("1", MONTH);

export const clearFamilySignedIn = () => write("", 0);

export const familySignedIn = () => document.cookie.split("; ").includes(`${NAME}=1`);
