# Research: DWTS Companion — Data Sources

**Date**: 2026-09-30
**Decision it informs**: `/brainstorm dwts-companion` — where live scores, history, photos and vote info come from
**Status**: Complete (gaps listed under Open Questions)

## Question
What automated sources exist for live judges' scores, historical data, headshots and voting mechanics for the Dancing with the Stars (US) season on air now, and how fast, parseable, reliable and legally safe is each one?

## Current season snapshot (Season 35)

| Item | Fact | Source |
|---|---|---|
| Season | 35. Premiered 2026-09-15; finale scheduled 2026-11-24 | [WP S35][wp35], [ABC Help][abchelp] |
| Air slot | Tuesdays 8:00 pm ET / 7c, live simulcast on ABC and Disney+. Premiere was two nights (Tue 9/15 men, Wed 9/16 women). One exception: **Mon 2026-11-02** instead of Tue 11/03 | [ABC Help][abchelp] |
| Runtime | 8:00–10:00 pm ET. The next ABC listing on 9/29 starts at 10:00 pm | [Futon Critic 9/29][futon] |
| Hosts | Alfonso Ribeiro, Julianne Hough | [WP S35][wp35] |
| Judges | Carrie Ann Inaba, Derek Hough, Bruno Tonioli. Wikipedia lists per-judge scores in that order | [WP S35][wp35] |
| Couples | 16 at the start, tied for the largest cast. 12 remain after week 3 | [WP S35][wp35] |

**Couples**

| Celebrity | Pro | Status (as of 9/30) |
|---|---|---|
| Conner Leavitt | Adele Zaikman | Out 1st (9/15) |
| Sarah Jane Nader | Hailey Bills | Out 2nd (9/16) |
| Giada De Laurentiis | Alan Bersten | Out 3rd (9/22) |
| Taylor Hanson | Britt Stewart | Out 4th (9/29) |
| Tatyana Ali | Jan Ravnik | In |
| Tyler Cameron | Sharna Burgess | In |
| Jenna Dewan | Val Chmerkovskiy | In |
| Ezra Frech | Daniella Karagach | In |
| Amber Glenn | Pasha Pashkov | In |
| Maura Higgins | Mark Ballas | In |
| Ciara Miller | Brandon Armstrong | In |
| Jackson Olson | Emma Slater | In |
| Guillermo Rodriguez | Witney Carson | In |
| Harry Shum Jr. | Jenna Johnson | In |
| Julia Stiles | Ezra Sosa | In |
| Connor Wood | Rylee Arnold | In |

**Schedule** (from [WP S35][wp35] episode table)

| Week | Date | Theme |
|---|---|---|
| 1 | 9/15 + 9/16 | Premiere, two nights. One elimination per night |
| 2 | 9/22 | Viral Hits |
| 3 | 9/29 | Yacht Rock |
| 4 | 10/6 | Mariah Carey |
| 5 | 10/13 | Super Bowl |
| 6 | 10/20 | Dedication |
| 7 | 10/27 | Horror Movie |
| 8 | **Mon** 11/2 | Disney |
| 9 | 11/10 | Grammy |
| 10 | 11/17 | Semi-Finals |
| 11 | 11/24 | Finale |

Episode numbers and week numbers do not line up. The premiere is episodes 1–2 but only week 1.

---

## Q1. Live judges' scores

### Measured: Wikipedia air-night edit latency
I pulled every revision of the S35 page during air windows through the MediaWiki API, parsed the weekly table in each one, and recorded when each couple's **final** score first appeared. The show starts at 00:00 UTC.

| Night | First score posted | Last score posted | Gap between postings | Wrong values seen |
|---|---|---|---|---|
| S35 wk3 (9/29) | 8:14 pm ET | 9:52 pm ET | 5–11 min, one per dance, 13 dances | A vandal edit at 01:23 UTC gave Jenna & Val a 30 (actual 21) and swapped Connor's per-judge scores. It was reverted in 1m46s |
| S35 wk2 (9/22) | 8:14 pm ET | 9:53 pm ET | 5–12 min, 14 dances | none |
| S34 wk2 (9/23/25) | 8:09 pm ET | 9:51 pm ET | 5–10 min, 14 dances | Whitney & Mark had 2 bad values, fixed within 60s |
| **S35 premiere (9/15, 9/16)** | **none live** | — | **0 edits on air nights** | The page was **fully protected (sysop-only) from 9/11 19:30 to 9/18 19:30 UTC** over an edit war, so premiere scores went in about 2 days late ([protect log][protlog]) |

- Scores show up in step with the dances, one every 5–12 min. That matches a single editor typing each score as the judges reveal it. The exact delay after the on-air reveal is **unverified**, because I have no per-dance broadcast timestamps. An estimated 1–5 min is inference.
- Current protection is autoconfirmed-only and **expires 2026-11-19 02:22 UTC**, before the finale ([API][protinfo]). After that, IP editors, and IP vandals, can edit on finale night unless an admin renews it.
- Editors keep a pre-built empty table for the next week with couples in **alphabetical** order (`<!-- LEAVE COUPLES LIST AS IS UNTIL EPISODE AIR DATE -->`), then reorder it into performance order during the show. Key rows by couple name, never by row position.

### Source comparison

| Source | Latency | Structure | Reliability | ToS / legal |
|---|---|---|---|---|
| **Wikipedia via MediaWiki API** (`action=query&prop=revisions&rvslots=main` or `action=parse&section=N&prop=wikitext`) | 5–12 min rolling, per dance (measured) | Wikitext table with a consistent `NN (a, b, c)` cell. Parseable | Good on normal weeks. **Failed completely on premiere week** because of protection. Transient vandalism and typos fixed within ~2 min | Text is CC BY-SA 4.0. Scores are facts, generally not copyrightable in the US (legal read **unverified**). API etiquette: descriptive User-Agent with contact info, serial requests, no hard read limit ([API:Etiquette][etiq]) |
| **Wikimedia EventStreams** `stream.wikimedia.org/v2/stream/recentchange` | Push, seconds after each edit | SSE JSON with revision id. Then fetch the revision | Same as above. Tells you *when* to fetch, so no polling | Same. Verified the stream is live ([stream][es]) |
| ABC / dwtsvote.abc.com (Telescope) | — | Public JSON at `widgetstate.votenow.tv/v1/state/8130c1850762f4d1`: couples, IDs, images, vote limits, window status. **No scores in it** | Official. Client polls it every 5s | Disney ToS; the JSON is undocumented. **Not a score source** |
| ABC.com show and news pages | Recap articles post-show (timing **unverified**) | HTML, no score fields found in the show-page payload | Official but slow | Disney ToS |
| Today.com recap | Published 00:15 UTC, last modified 02:10 UTC on 9/29–30, so updated during the show | Prose, "24/30" style, some per-judge | Single writer | Scraping likely violates ToS (**unverified**, not read) |
| Yahoo / GoldDerby / Parade / TVLine recaps | Yahoo published 23:58 UTC (pre-show shell). GoldDerby 23:00 UTC. In-show update cadence **unverified** | Prose, no `LiveBlogPosting` schema found | Varies | GoldDerby robots.txt disallows `anthropic-ai` and other AI agents. Scraping news sites is ToS-risky |
| MJsBigBlog live blog | Post-show compile, no per-update timestamps | `Carrie Ann- 8, Derek- 8, Bruno- 8 = 24/30`. Regular, parseable | Hobby site | Personal blog, no API, ToS risk |
| X / Twitter (@officialdwts) | Whether it posts per-dance scores is **unverified** | Free text | — | Pay-per-use API, **no free tier**. $0.005 per post read, $0.010 per user-timeline resource ([X pricing][xprice]) |
| Reddit live threads | **Unverified**: Reddit blocks unauthenticated access from this environment | Comment soup | Low | Reddit API terms require approval for commercial use (**unverified**) |
| GitHub fantasy-league apps (e.g. `fkherb/mirrorball-fantasy-league`) | Commits during the show (01:27–01:58 UTC 9/30) | App-specific | Third party | No license declared |

### Wikipedia score markup (real, S35 week 3, as of 2026-09-30)
```wikitext
=== Week 3: Yacht Rock Night ===
...
{| class="wikitable sortable" style="text-align:center; width:90%"
|+''Dancing with the Stars'' (season 35) – Week 3
|-
! scope="col" | Couple
! scope="col" | Scores
! scope="col" class="unsortable"| Dance
! scope="col" class="unsortable"| Music
! scope="col" class="unsortable"| Result
|-
! scope="row" | Amber & Pasha
| 24 (8, 8, 8)
| Foxtrot
| "[[Hold the Line]]" — [[Toto (band)|Toto]]
| Safe
|-
! scope="row" | Taylor & Britt
| 18 (6, 6, 6)
| Foxtrot
| "[[What a Fool Believes#The Doobie Brothers version|What a Fool Believes]]" — [[The Doobie Brothers]]
| bgcolor= f4c7b8 | Eliminated
|}
```
Parsing gotchas seen in real pages:
- Row header wrappers such as `{{nowrap|Connor W.}}`, `{{efn|...}}` footnotes and `{{dagger}}` on the season scoring chart.
- A judge-order line sits above each week: `''Individual judges' scores ... Carrie Ann Inaba, Derek Hough, Bruno Tonioli.''` It **changes** on guest-judge or absent-judge weeks. Parse it per week.
- Couples with multiple dances in a week use `! rowspan="2" scope="row"`, with continuation rows starting at `|`. A naive single-row regex returned 0 couples on S34 week 10.
- Short names disambiguate on collision: "Conner L." vs "Connor W." in S35 week 1.
- `action=parse&prop=sections` gives stable section indexes (S35: Weekly scores = 8, weeks = 9–12), so you can pull one week with `section=N`.

---

## Q2. Historical backfill

| Source | Coverage | Structure | License |
|---|---|---|---|
| **Wikipedia season pages S1–S34** | All 34 pages exist. Each has `=== Week N ===` sections and a score cell per dance, 36–121 per season | `NN (a, b, c)` in 33 of 34 seasons. Variants below | CC BY-SA 4.0 |
| Kaggle `brupley/dancing-with-the-stars-dataset` | S1–S32 only. Averages multi-score weeks. Drops guest judges in 5-judge weeks. "Not every individual score was collected" | CSV | CC BY-SA 4.0 ([Kaggle API][kaggle]) |
| GitHub `howisonlab/dwts_dataset` | Scrapy scrape of Wikipedia. Last push 2023-01-09, so roughly ≤ S31. Drops group dances, averages dual scores, keeps only the primary style and song for medleys, ids unstable between runs | Normalized CSVs | **GPL-3.0** ([repo][howison]) |
| GitHub `jowhiteh22/DAT153-Final-Project` | "Normalized database … through season 33" | — | No license declared, so all rights reserved |
| 2026 MCM Problem C repos | DWTS was the 2026 COMAP contest problem. Several repos carry contest data | — | No licenses. COMAP data terms **unverified** |

Format variants across S1–S34, from grepping all 34 pages:

| Variant | Where |
|---|---|
| Separate per-judge columns plus a Total column, **half points** (`6.5`) | S15 (All-Stars) |
| 4-judge `NN (a, b, c, d)` cells | S11–S34, mostly guest-judge weeks |
| 5-judge cells | S31 |
| 2-judge cells (a judge absent, 20-pt scale) | S34 week 1 |
| Multi-dance rowspan rows | S9, S10, S31–S34 |
| Finale "Judge" column (judge-picked dance) | S34 |
| 4-week short season | S26 (athletes) |

Verdict: Wikipedia is complete for S1–S34, and structurally consistent enough to parse with about 6 special cases. The existing datasets are stale and lossy, and the one with a clean license (Kaggle) stops at S32.

---

## Q3. Headshots

Wikimedia Commons coverage for the S35 cast, checked through the `pageimages` and `imageinfo` APIs:

| Person | Commons file | License | Photo date |
|---|---|---|---|
| Amber Glenn | Amber_Glenn_in_2026.jpg | CC BY 4.0 | 2026 |
| Ezra Frech | Ezra_Frech_Milan_2026.jpg | Public domain (US Embassy) | 2026 |
| Jenna Dewan | Jenna_Dewan_at_San_Diego_Comic_Con_2026-2.jpg | CC BY 4.0 | 2026 |
| Harry Shum Jr. | …San_Diego_ComicCon_2017 | CC BY-SA 4.0 | 2017 |
| Maura Higgins | …World_premier… | CC BY-SA 4.0 | 2024 |
| Guillermo Rodriguez | GuillermoDíazHWOFJan2013_(cropped).jpg (from the Kimmel Walk of Fame ceremony; confirm by eye it's him) | CC BY-SA 3.0 | 2013 |
| Tatyana Ali | Streamy_Awards_Photo_1302 | CC BY-SA 2.0 | 2010 |
| Taylor Hanson | Hanson_(33424899242).jpg (band photo) | CC BY 2.0 | 2017 |
| Julia Stiles | …by_David_Shankbone_cropped | CC BY-SA 3.0 | 2007 |
| Giada De Laurentiis | Giada_De_Laurentiis_2010.jpg | CC BY 2.0 | 2010 |
| **No image** | Tyler Cameron, Ciara Miller, Jackson Olson, Connor Wood, Sarah Jane Nader. Conner Leavitt has no article | — | — |
| Pros with image | Pasha Pashkov, Daniella Karagach (CC BY 3.0), Mark Ballas (CC BY 2.0), Sharna Burgess (CC BY-SA 2.0), Emma Slater (CC BY-SA 4.0), Witney Carson (CC BY-SA 4.0), Britt Stewart (CC BY-SA 4.0) | | |
| Pros unusable or none | Jan Ravnik (the page image is an Eras Tour group shot), Brandon Armstrong, Rylee Arnold, Val Chmerkovskiy, Jenna Johnson, Alan Bersten, Ezra Sosa, Adele Zaikman, Hailey Bills | | |
| Judges and hosts | All five have Commons images (CC BY / BY-SA) | | |

Coverage: celebrities 10/16 (several photos 10+ years old), pros 7/16 usable.

Reuse terms ([Commons reuse guide][commons]):
- Credit the author, name the license with a link, and link the source.
- Share-alike covers derivatives only. A cropped headshot of a BY-SA photo is arguably a derivative, so publish the crop under BY-SA. That obligation does not spread to the rest of the site.
- Personality rights sit outside copyright. Commercial use of an identifiable person can need consent.

Fallbacks:

| Source | Notes |
|---|---|
| Telescope vote-widget images (`ts-cms-production.votenow.tv/widgets/81/30/8130c1850762f4d1/...png`, one per couple, in the public widget JSON) | Official ABC couple art, complete and current. **ABC copyright, no reuse license**. Hotlinking or copying it is a legal risk |
| Wikipedia infobox poster (`DWTS US Season 35 Poster.jpg`) | Non-free, fair use on Wikipedia only. Not reusable |
| Initials or silhouette placeholder | Zero risk |
| Ask the talent or their reps, or an ABC press site | Press-site terms and access **unverified** |

---

## Q4. Voting mechanics (Season 35)

Primary source: [ABC Help Center][abchelp], updated 2026-09-22. Limits cross-checked against the live widget config.

| Item | Fact |
|---|---|
| Methods | Online at `dwtsvote.abc.com` (needs a Disney/ABC account plus one-time email verification), and SMS. A Disney+ subscription is not required. No in-app Disney+ voting is mentioned |
| Limit | **10 votes per couple per method**, so 20 per couple total. Online votes can be reallocated until the window closes ("Save Votes"). SMS votes are final. The widget config has `max_votes_per_contestant: 10` and `max_votes: 130` (13 active couples × 10) ([widget JSON][ws]) |
| SMS | Text the couple's keyword to **21523**. "The keyword for each couple will be listed on our FAQ page when voting begins." Past seasons used the celebrity first name in caps (e.g. `JOEY`); the S35 keyword list is **unverified**. In premiere week, viewers were told to add the last-name initial for the two Connors ([WP S35][wp35]) |
| Window | Opens 8/7c. Closes "shortly after the final competitive dance". Only during the **initial Eastern/Central simulcast**, so Mountain and Pacific viewers must vote live, not during their local airing. Premiere week: only that night's couples were votable |
| Eligibility | 18+. Online: US + territories + Canada. SMS: US + territories only |
| Incident | S35 week 1 night 1: online votes were **thrown out** after technical problems and only SMS counted ([WP S35][wp35]) |
| Per-couple deep link | **None found.** The vote app is a Telescope SPA (`hashState: false`). Couple IDs in the widget JSON are `A1`–`P1`, with no URL routing. Fetching `/rules` served the same closed-window view as `/`, so no sub-route renders per couple. The absence of a hidden deep link is **inference** |
| Bot protection | `dwtsvote.abc.com` sits behind a JS "Client Challenge"; the config shows `fastly_captcha_enabled: true`. Any automated voting would break ToS and is technically blocked |

---

## Q5. Scoring format a data model must handle

| Case | Seen where | Shape |
|---|---|---|
| 3 judges, 1–10 each, 30 max | S35 so far | `21 (7, 7, 7)` |
| Guest judge, 4 judges, 40 max | S34 weeks 5–9 (5 guest weeks). S35 has none announced as of 9/30 (**unverified**) | `37 (9, 9, 9, 10)`. Judge order changes per week |
| Judge absent, 20 max | S34 week 1 | `NN (a, b)` |
| Two-night week, eliminations each night | S35 week 1 | Two tables under one week |
| Multiple dances per couple per week | Semis and finale | Rowspan rows |
| Finale with judge-assigned dance plus instant dance plus freestyle | S34 week 11 | Extra "Judge" column |
| Dance marathon bonus points | S34 week 7 | Bare integers (`0`, `1`, `2`…) in the score cell, not per-judge |
| Team dance, one score shared by several couples | S34 week 8 | Row header lists several couples joined by `<br />` |
| Relay or dance-off, 2 bonus points to the winner, plus immunity | S34 week 9 | Separate table with "Winners/Losers", no per-judge scores |
| No-elimination week, scores carried over | S34 weeks 1 and 5 | Result "Safe" for everyone, cumulative total matters |
| Score from dress-rehearsal footage (injury) | S34 week 7 | Normal cell plus a note |
| Half points | S15 | Decimal per-judge |

---

## Recommendation (separable from findings)
- **Primary live source: Wikipedia S35 page.** Use EventStreams `recentchange`, filtered to that title, as the trigger. Fetch the new revision and parse the current week's section. Treat a score as confirmed only after it survives about 3 minutes or a later revision, to absorb vandalism and typos. Expect roughly one update per dance.
- **Fallback: a manual override.** Two failure modes were measured: premiere-week protection gave zero live data, and finale-week protection lapses on 11/19. Neither is fixable by automation. A one-tap admin correction, or a second human, is the only reliable backstop. Among automated sources, the Today.com recap is the best-evidenced in-show updater, but it is prose and ToS-risky.
- **History:** parse Wikipedia S1–S34 directly (CC BY-SA, with attribution). Don't use the stale, lossy datasets.
- **Photos:** Commons where available, with attribution. Use initials placeholders for the 6 celebs and 9 pros without one. Don't reuse the ABC widget art.
- **Voting:** link to `dwtsvote.abc.com` and show `21523` plus the keyword once it's published on the FAQ. There is no per-couple deep link.

## Key Links / References
- [wp35]: https://en.wikipedia.org/wiki/Dancing_with_the_Stars_(American_TV_series)_season_35
- [protlog]: https://en.wikipedia.org/w/index.php?title=Special:Log&type=protect&page=Dancing_with_the_Stars_(American_TV_series)_season_35
- [protinfo]: https://en.wikipedia.org/w/api.php?action=query&titles=Dancing_with_the_Stars_(American_TV_series)_season_35&prop=info&inprop=protection
- Revision API used: `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=...&rvprop=ids|timestamp|content&rvslots=main&rvstart=...&rvend=...&rvdir=newer`
- [etiq]: https://www.mediawiki.org/wiki/API:Etiquette
- [es]: https://stream.wikimedia.org/v2/stream/recentchange
- [abchelp]: https://help.abc.com/article/abc-dancing-with-the-stars-on-abc-and-disney
- [ws]: https://widgetstate.votenow.tv/v1/state/8130c1850762f4d1 (config found in the dwtsvote.abc.com page source)
- [futon]: http://www.thefutoncritic.com/listings/2026/09/29/
- [xprice]: https://docs.x.com/x-api/getting-started/pricing
- [kaggle]: https://www.kaggle.com/datasets/brupley/dancing-with-the-stars-dataset
- [howison]: https://github.com/howisonlab/dwts_dataset
- [commons]: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- Secondary voting guides that agree with ABC: https://hollywoodlife.com/2026/09/16/how-to-vote-dancing-with-the-stars-season-35/, https://entertainmentnow.com/dancing-with-the-stars/season-35-how-vote-guide-two-night-premiere-rules/
- Recaps checked for timing: https://www.today.com/popculture/tv/dancing-with-stars-season-35-scores-who-eliminated-week-3-rcna600549, https://www.goldderby.com/reality-tv/2026/dancing-with-the-stars-season-35-recap-yacht-rock-night/, https://www.mjsbigblog.com/dancing-with-the-stars-35-recap-yacht-rock-week-3-live-blog.htm

## Open Questions
- [ ] True delay from on-air score reveal to Wikipedia edit. Needs one live night with a stopwatch against the broadcast.
- [ ] S35 SMS keywords. Check `dwtsvote.abc.com/faq` during the 10/6 window (8–10 pm ET).
- [ ] Does @officialdwts on X post per-dance scores, and how quickly? Needs X access.
- [ ] Reddit live-thread latency: not reachable from this environment.
- [ ] Guest judges or special formats announced for S35 weeks 5–11 (Super Bowl, Dedication, Horror, Disney, Grammy).
- [ ] Legal read on republishing Wikipedia-derived scores commercially (facts vs. CC BY-SA table text).
- [ ] Whether ABC has a press/media site with licensable cast photos.
