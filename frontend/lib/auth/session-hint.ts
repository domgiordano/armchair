// A plain module, not "use client": the layout inlines SESSION_HINT_SCRIPT into
// <head>, and a server component importing from a client module gets a
// reference instead of the string.

// Amplify keeps the last signed-in user under a key ending in this. Present
// means a session is likely, before Amplify has confirmed it.
const KEY_SUFFIX = ".LastAuthUser";

export const likelySignedIn = () => Object.keys(localStorage).some((k) => k.endsWith(KEY_SUFFIX));

// Runs before first paint and marks <html data-session>, so the intro's
// load-in stage in the static HTML stays hidden for someone who is signed in.
export const SESSION_HINT_SCRIPT = `try{if(Object.keys(localStorage).some(function(k){return k.slice(-${KEY_SUFFIX.length})==="${KEY_SUFFIX}"}))document.documentElement.setAttribute("data-session","")}catch(e){}`;
