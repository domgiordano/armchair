// Shared by the Intro client component and the root layout's head script. The
// layout can't import these from intro.tsx: a server component importing from
// a "use client" module gets client references, not values.
export const INTRO_KEY = "armchair-hub:intro-seen";

// Runs in <head> before paint, so a returning visitor never sees a frame of
// the stage the server rendered for first-timers.
export const introSkipScript = `try{if(matchMedia("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem("${INTRO_KEY}"))document.documentElement.dataset.intro="skip"}catch(e){}`;
