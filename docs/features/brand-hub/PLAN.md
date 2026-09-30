# Plan: Armchair Judge brand, hub site and show landing pages

**Status**: Ready
**Created**: 2026-09-30

## Summary
Brand the family as **Armchair Judge** from Dom's logo (`brand/armchair-judge-logo.png`). Build a hub site that introduces the idea and routes to each show app, and give the DWTS app a themed signed-out landing. Both open with a ~5 s skippable intro, modelled on Dom's Lumist/Areté sites: full-screen scene → resolves into the logo mark → landing with eyebrow, two-tone headline, one paragraph, primary + secondary CTA, a live illustration from invented data, then explainer sections.

## Decisions
- **Hosts.** The hub lives at `armchair.xomware.com` until `armchairjudge.com` is bought; DWTS stays at `dwts.xomware.com`. Both hosts are Terraform variables, so the move is config.
- **Code layout.** Hub is a second static Next app, `hub/`, in this repo with its own bucket, distribution and deploy workflow. No shared package yet: DWTS is the second consumer of the brand, so assets and the intro shell are copied, not extracted (extract at the third show).
- **Intro.** Code-driven (CSS/SVG), not a video file: sharp at any size, ~0 KB of media. Plays once per browser session, "Skip" bottom-right, jumps straight to the landing under `prefers-reduced-motion`.
- **Brand tokens** (from the logo): background `#02081e`; gradient blue `#3b5bff` → violet `#7a2cff` → magenta `#e83fd0` → orange `#ff7a3d`; crown gold `#ffc93c`. Display type Poppins 700/800; eyebrow/tagline Poppins 500, wide tracking ("DISCOVER / WATCH / JUDGE").
- **Show themes evoke, never copy.** DWTS: midnight navy, gold, mirror-ball silver, sparkles, a serif display face. Traitors: candlelit castle, deep green/black, Cinzel-style serif. Survivor: torches, bamboo, burnt orange, rough brush type. No show logos, wordmarks or artwork. Show names are used descriptively only, with a "not affiliated with" line in the footer.
- **Coming soon.** Traitors and Survivor cards are dimmed behind diagonal caution tape reading "COMING SOON", not clickable.

## PRs
| # | PR | ~Logic | Needs |
|---|---|---|---|
| B1 | DWTS app brand: logo assets, favicon/apple-icon/OG, Poppins, tokens, header mark | ~60 | — |
| B2 | Hub scaffold: `hub/` Next app, Terraform `armchair.xomware.com` site, deploy workflow | ~80 | — |
| B3 | Hub intro: armchair scene, crown drop, "10" paddle flip, gradient wordmark, tagline, Skip | ~150 | B2 |
| B4 | Hub landing: hero, how it works (watch → paddle → reveal → accuracy), show cards incl. caution-tape coming soon, footer disclaimer | ~200 | B3 |
| B5 | DWTS signed-out landing: mirror-ball intro (~5 s), explainer sections with the real desk component on invented data, sign-in CTA | ~250 | B1 |

## Deferred
- Buy `armchairjudge.com`, move hub to apex and shows to `<show>.armchairjudge.com`, custom Cognito `auth.` domain so Google's consent screen names Armchair Judge.
- Vector (SVG) redraw of the mark for crisper animation; the intro uses the PNG mark until then.
