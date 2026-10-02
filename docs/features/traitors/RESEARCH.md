# Research: The Traitors (US + UK) — Seasons, Data Sources, Event Model

**Date**: 2026-10-02
**Decision it informs**: `/brainstorm traitors`. It covers which seasons to launch on, where live results come from, how to model events per episode, and photos.
**Status**: Complete (gaps listed under Open Questions)

## Question
Which US and UK Traitors seasons are airing now? How are they released? Can Wikipedia, or anything faster, supply per-player round-table votes, murders, recruits and winners quickly and parseably enough to settle blind predictions?

All Wikipedia revision ids below were fetched 2026-10-02 via `action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main`. Wikipedia text is CC BY-SA 4.0.

---

## Q1. What's airing now

The premise needs two corrections:
- The US season on air now is on **NBC broadcast**, not Peacock-first. It streams on Peacock the next day.
- The UK show on air now is **The Celebrity Traitors series 2**. The civilian series 5 has no date.

| | US: *The Traitors: New Blood* (season 5) | UK: *The Celebrity Traitors* series 2 | US season 6 | UK civilian series 5 |
|---|---|---|---|---|
| Status | Airing | Airing | Upcoming | Not announced |
| Network | NBC. "episodes releasing the next day on Peacock" ([WP NB][wpnb], [NBC Insider][nbcnb]) | BBC One and iPlayer ([BBC Media Centre][bbcmc]) | Peacock ([WP US6][wpus6]) | BBC (assumed) |
| Premiere | Thu 2026-09-17 ([Futon][futon]) | Thu 2026-10-01 ([BBC MC][bbcmc]) | "early 2027". Infobox dates are `{{void}}`, so **unknown** | **unknown**. "expected January 2027", BBC hasn't announced ([TechAdvisor][techadv]). Series 3 and 4 premiered 1 Jan ([WP UK][wpuk]) |
| Cadence | 9/17: eps 1–2 (8:00 and 8:56 pm ET). 9/24: eps 3–4 (8 and 9 pm). **No ep 10/1** (MLB Wild Card). Then 1 per Thursday from 10/8 to 11/12. Finale 11/19: eps 11–12 at 8 and 9 pm ([Futon][futon], [Hidden Remote][hr]) | Thu + Fri at 8:00 pm, "two nights a week" ([BBC MC][bbcmc]) | Past Peacock pattern (S4): 3 eps at premiere, 2 in week 2, then 1 weekly on Thursdays ([Forbes S4][forbes]) | Past pattern (S4): Thu/Fri/Sat for week 1, then Wed/Thu/Fri at 8 pm GMT. Finale 8:30 pm, 75 min ([Scotsman][scots], [WP UK4][wpuk4]) |
| Time | 8:00 pm ET = **00:00 UTC Fri** (EDT). Pacific airing time **unknown** ("8/7c") | 8:00 pm BST = **19:00 UTC**. Episodes run 4380 s, about 73 min ([BBC programmes JSON][bbcep]) | S4: "6pm PT/9pm ET" per [Forbes][forbes], but edits contradict this (see Q3) | — |
| Episodes | 12. Ep 7–12 are `{{void}}` placeholders ([WP NB][wpnb]) | 10 ([WP CS2][wpcs2]). Eps 1–4 dated 10/1, 10/2, 10/8, 10/9 ([BBC JSON][bbcep]). Eps 5–10 run 10/15–10/30 per a secondary schedule (**unverified**) | **unknown** | 12 ([TechAdvisor][techadv], **unverified**) |
| Players | 22, all civilians ([WP NB][wpnb]) | 21 celebrities ([WP CS2][wpcs2]) | 23 celebrities ([WP US6][wpus6]) | — |
| WP title | `The Traitors: New Blood` (pageid 83493607). A move to `The Traitors (American TV series) season 5` is under discussion; that title currently redirects here | `The Celebrity Traitors series 2` (pageid 83087125) | `The Traitors (American TV series) season 6` (84275548) | redlink |
| State as of 10/2 | 4 episodes aired. Out: Kim (murdered), Madeline (banished), Xavier (murdered), Arisa (banished), Logan (murdered). Traitors: Joe, Tomica, plus recruit Katie | 1 episode aired. Traitors: Maya Jama, Richard E. Grant. A recruit is pending in ep 2 tonight (2026-10-02 19:00 UTC) | Cast announced | — |

New Blood adds a $15,000 pot bonus per banished Traitor. Ep 1 introduced "Accomplices": two candidates, one recruited and the other murdered ([WP NB][wpnb] rev 1377883386).

---

## Q2. Wikipedia table structure

Pages fetched:

| Page | Rev |
|---|---|
| New Blood | 1377883386 |
| Celebrity S2 | 1378006453 |
| US S1 | 1376554999 |
| US S2 | 1376555148 |
| US S3 | 1376555194 |
| US S4 | 1376576846 |
| UK S1 | 1377652850 |
| UK S2 | 1374212300 |
| UK S3 | 1374212064 |
| UK S4 | 1374211799 |
| Celebrity S1 | 1378003069 |

**Sections.** The `Contestants` table has columns Contestant / Age / Hometown or Notability / Occupation / **Affiliation** / **Finish**. Then one big table under `== Elimination history ==`. US S4 calls it `==Voting history==`. Then `=== End game ===` for finished seasons. Neither page has a separate "Voting history" table: per-player votes sit inside the elimination table.

**Elimination table layout**, top to bottom:
1. Header row `! colspan="3"|Episode` then one `!N` per column. **Columns are not episodes.** One episode can own 2–3 columns (`!colspan="3"|5` in UK S4 = vote, revote, Fate). New Blood labels columns `3/4` and `4/5` because a round-table/night cycle straddles two episodes.
2. Optional rows: `Murder Shortlist` / `Secret Traitor Shortlist`.
3. `Traitors' Decision`, two rows: the name(s), then the action word in italics: `''Murder''`, `''Recruit''`, `''Seduce''`, `''Offer''`, `''Ultimatum''`, `''Shortlist''`, `''Accomplice''`, `''Amulet''`, `''Dagger''`, `''Condemn''`, `''On Trial''`. A cell can hold two names (`Katie<br />Xavier`, `Amol<br />James A.`). Struck names (`<s>Leanne</s>`) mean a murder the Seer or a shield blocked. Faction comes from the cell colour: `#0047AB` Faithful, `#67002F` Traitor, `#D4BA79` Accomplice.
4. `Shield` / `Immune`: `{{unbulleted list|...}}`, `{{N/A|''None''}}`, or `{{N/A|''All''}}` (no murder that night).
5. `Banishment`: the name, coloured by revealed faction, or `''Tie''` on a light-grey cell.
6. `Vote`: **counts only, no names**, e.g. `13–7–1` or `{{nowrap|16–1–1–<br />1–1–1}}`. En dash, but `3-1-1` with a hyphen appears in UK S4. `Fate` marks a chest tiebreak.
7. `|- style="border-top:5px solid"`, then one row per player: two faction-colour cells, `! Name`, then one cell per column holding **who that player voted for**. Eliminated players get one spanning cell: `colspan="N" style="background:salmon"|''Banished''<br><small>(Episode 4)</small>`, or `darkred` + `''Murdered''`, or `#fcf` `''Quit''`, or `#FF8C00` `''Eliminated''` (forfeit, UK S3). Pre-filled future cells hold `{{TBA}}`.

**Is top-3 derivable?** Yes. I expanded rowspan/colspan into a grid, counted per-player cells per column, and compared the result with the `Vote` row. It matched in **33 of 34** round tables across US S4, UK S4, Celebrity S1 and New Blood. The one miss is UK S4 ep 10 (`5–3–1` vs 4–3–1), where the Dagger double vote is only an `{{efn}}` footnote. Ranking 2nd and 3rd often needs a tie rule (`5–2–2`, `4–2–2–1`).

**Special cases and their markup**

| Case | Seen | Markup |
|---|---|---|
| Tie, then revote | UK2, UK4 ×2, US3, Celebrity S1 | Two columns. Column 1: Banishment `''Tie''`, full counts. Column 2: revote counts. Tied players' cells read `''No<br />vote''{{efn|name=Tied}}`, because tied players don't vote and others may only vote for the tied names |
| Revote still tied | UK4 ep 5 and ep 11→12, Celebrity S1 ep 5→6 | Third column, Vote = `Fate{{efn|…two chests…}}`. Every per-player cell is `rowspan` `''No vote''` |
| Tie resolved next episode | US3 ep 10→11 (`{{efn|…cliffhanger…}}`), UK4 ep 11→12 | The result lands in a column labelled with the later episode |
| Two banishments in one episode | Celebrity S1 ep 3 and ep 6, UK2 ep 4, UK3 ep 2 | Two banishment columns under one episode header |
| Dagger (vote counts double) | US4 ep 10, UK4 ep 10 | US: `Natalie (2x)` in the cell. UK: `{{efn|name=Dagger}}` only. Inconsistent |
| Murder in plain sight | US2, US3, US4, UK1, UK2, Celebrity S1 | Action word `''Amulet''`/`''Murder''` plus an `{{efn}}` describing it. No distinct field |
| Recruitment | All seasons | `''Recruit''`/`''Seduce''`/`''Offer''` (can be declined: US2 Peter); `''Ultimatum''` (accept or be murdered). The recruit's Contestants-row Affiliation is two colour cells (Faithful then Traitor) |
| Recruit **and** murder in one night | US2 ep 9, US4 ep 9, UK1 ep 10 | Two decision columns under one episode |
| Secret Traitor | US4, UK4 | Extra `Secret Traitor Shortlist` row; Traitors pick only from it |
| Seer | US3, UK3 | `{{efn|No murder took place; having become the Seer…}}` on a `{{N/A|''None''}}` decision |
| Accomplice | New Blood | Colour `#D4BA79`; action `''Accomplice''` |
| Night with no murder | Many (shield "All", Seer, Confessional) | `{{N/A|''None''}}` plus efn |
| Banishment without reveal | Celebrity S1 finale only: "the players would not reveal their identities as they exited" | Prose. No special table markup found |
| End game | All finished seasons | Separate `===End game===` table. Decision row alternates `''Banish''` / name / `''End Game''`. Per-player cells read `''Banish''`, `''Banish Again''` or `''End Game''`. Winners: `style="background:gold"|'''Winner(s)'''`, runners-up `silver`. Result cell: `''Game Over<br>Traitor Win''` / `''Faithfuls Win''`. An end-game banishment can tie too (US2: `''Tie''`) |
| Quit / forfeit | US1, US2 (`#fcf` `''Quit''`), UK3 (`#FF8C00` `''Eliminated''`) | Spanning cell |

**Parser notes**
- Clean cells of `{{efn|…}}` (which can nest), `{{nowrap|}}`, `{{font color|white|…}}`, `<br />`, `''`, `<s>`, and `style`/`bgcolor` attribute prefixes. Some attribute strings are malformed (`rowspan="2 {{N/A|''None''}}`, `width="10% |`).
- Names in the table are short forms (`Abbey B.`, `Rob R.`, `James A.`, `Joe M.`). Match them to Contestants rows by alias, as DWTS does.
- `common/wiki_parse.py` already has `expand()` for rowspan/colspan. My throwaway grid parser needed the same thing.
- Rows in one column don't always describe the same night. In US4 the Shield row reads `''All''` (no murder possible) in column 5, while column 5's Decision is Monét's murder. The efn ties that `All` to the amulet night in column 6. Don't assume the rows in a column line up.

---

## Q3. Update latency, vandalism, protection

Method: pulled every revision in the windows below, re-parsed each one, and recorded when a value first appeared and when the per-player cells first summed to the final tally.

| Night (UTC) | Release | Banished name first on WP | Per-player votes complete | Murder/decision first |
|---|---|---|---|---|
| NB ep 1–2, 9/18 | NBC 00:00, ep 2 from 00:56 | 03:50 (~1h50m after air end) | **04:56** | Kim: 03:50 |
| NB ep 3–4, 9/25 | 00:00 / 01:00 | **01:07**, mid-ep 4. Partial counts (`3–1`, `4–1`, `5–1–1`) went live from 01:04 | **02:29** (~30 min after air end) | Xavier 00:11, Logan 01:32 |
| Celeb S2 ep 1, 10/1 | BBC 19:00, about 73 min | no round table | — | Traitor identities 19:35 (during broadcast). Recruit shortlist 20:45 |
| US S4 (Peacock), 10 nights Jan–Feb | stated 02:00 | 01:39–03:38. Median ≈ 02:20 | Usually the same edit. Ep 4 +19 min, ep 8 +21 min | — |
| UK S4, 11 nights Jan 2026 | BBC 20:00 | **20:46–21:24**. 9 of 11 fell between 20:46 and 20:58 | Same edit in 7 of 11. Ep 4 next day 12:21. Ep 5 tie next day 21:03 | — |

- **US S4 release time conflict.** The lead editor wrote "Its live" at 01:35 UTC on 1/9 and "episode up" at 01:34 UTC on 2/27. Ep 6's banishment was posted at 01:57 UTC. All three are before the 9 pm ET (02:00 UTC) drop Forbes states. The real drop time is **unknown**.
- **Values change mid-show.** Editors type round-table votes as they're revealed, so a 180 s window can confirm a partial tally. A completeness check is needed: sum of cells = eligible voters, and Banishment is filled.
- **Pre-release spoilers.** On 2026-02-26, 16:53–17:01 UTC, about 9 h before the US S4 finale drop, IP/new editors added finale cells (`runner up`, `''Murdered''<br><small>(Episode 11)</small>`). They were gone by 18:10. Whether they were leaks or guesses is **unknown**.
- **One editor carries it.** JoyfullySmile made 113/143 (79%) of US S4 voting-section edits, 112/184 (61%) for UK S4 and 21/38 (55%) for New Blood.
- **Reverts.** US S4: 46 of 349 revisions reverted, 13 of them changing parsed vote/decision data, reverted after 11 min–11.8 h. UK S4: 42 of 571, 6 data-changing, 1 min–37 h. New Blood: 6 of 115; Celeb S2: 9 of 65. Most were layout disputes between regulars, not vandalism. The worst case: New Blood was **turned into a redirect twice** (9/19 22:57 → 9/20 16:34, and 9/20 18:19 → 22:26 UTC). A parser reading it then got a 149-byte page.
- **Protection: none.** `prop=info&inprop=protection` is `[]` for New Blood, Celeb S2 and US S6, and `list=logevents&letype=protect` is empty for those plus US S4, UK S4 and Celebrity S1. IP edits are open on air nights.

---

## Q4. Alternative sources

| Source | Latency (measured) | Structure | Licence / ToS |
|---|---|---|---|
| **Wikipedia** (MediaWiki API, EventStreams) | Above: about 0–60 min after the round table airs | One table, per-player votes | CC BY-SA 4.0. API etiquette as in DWTS research |
| **Fandom** `thetraitors.fandom.com` (US + international), `thetraitorsuk.fandom.com` | NB ep 2 votes posted 9/18 21:32 UTC (**+21.5 h** vs WP's 04:56). Ep 3–4 votes 9/25 02:49 (+20 min vs WP). Template has 13 revisions total | Voting table lives in a transcluded template, `Template:US5 Voting History` (rev 39186; renamed from `USNB1` on 9/22). UK: `Template:UKC2 Voting History`. Cells use a custom `{{c|class|text|colspan}}` | `api.php` works (MediaWiki 1.43.9). siteinfo rights: "CC-BY-SA" → fandom.com/licensing. HTML pages and robots.txt sit behind a Cloudflare challenge. ToS on automated access **unknown** (fandom.com/terms-of-use returned 402/403) |
| BBC `/programmes/{pid}.json` | Schedule only | Episode list with `first_broadcast_date` (brand `m002csng`, series `m0030pxs`) | Undocumented. BBC terms **unknown**. No results data |
| NBC / Peacock / NBC Insider | Articles only. No structured results found | — | NBCU ToS. **unknown** whether a JSON feed exists |
| Reddit episode threads | **unknown**. Reddit blocks this environment | — | — |

**Manual entry load.** Results needed per round table: banished name, top-3 counts, the night's murder(s) and recruit(s). That's about 5 values. Weekly event counts at peak:
- New Blood: 1 episode per week (2 on 11/19).
- Celeb S2: 2 episodes per week.
- UK civilian in January: 3 per week.
- US S6 premiere week: 3 at once.

Full per-player votes would be up to 20 cells per round table.

---

## Q5. Events per episode

From parsing all 9 finished seasons plus New Blood:

| Pattern | Seasons |
|---|---|
| **Ep 1 has no round table** | All of them. US1's table starts at ep 2. UK3 ep 1 has a murder. US2 ep 1 is a recruit `''Offer''`. Celebrity S1 has no round table until **ep 3** |
| Typical episode: 1 round table + 1 night | Most mid-season episodes |
| 2 round tables in one episode | Celebrity S1 ep 3 and 6, UK2 ep 4, UK3 ep 2, UK4 ep 12 (Fate then a fresh round table) |
| Round table straddles episodes | NB `3/4` and `4/5` columns, US3 ep 10→11 tie cliffhanger, UK4 ep 11→12 |
| Night has no murder | Shield-all (US4 amulet night, UK4 ep 11), Seer (US3, UK3), Confessional (UK4 ep 7), finale episodes |
| Night has 2 actions | Recruit + murder: US2 ep 9, US4 ep 9, UK1 ep 10, UK2 ep 2 |
| Murder by shortlist/game | US4 (amulet; jack-in-a-box), US3 (coffin), UK4 (fingerprint shortlist) |
| Finale | Last regular round table(s), then End game: alternating "end game or banish again" votes, then winners. US finales are 2 episodes in one night (S4, NB 11/19); UK is 1 long episode |
| Murder shown | Under the column of the episode where it's revealed, e.g. `Murdered (Episode 4)`. Murders can be revealed at the end of an episode or the start of the next |

---

## Q6. Headshots

Licences checked through the Commons `imageinfo` extmetadata API:

| Cast | Coverage | Examples |
|---|---|---|
| New Blood (civilians) | **1 of 22**. Xavier Scruggs: `…Memphis Redbirds in 2015 (Cropped).jpg`, CC BY 2.0. Nobody else has an article | — |
| Celebrity S2 | **18 of 21** shown in WP's gallery, all on Commons. Amol Rajan, King Kenny and Sharon Rooney have no page image | Bella Ramsey CC BY-SA 4.0 (2026). Hannah Fry CC BY 4.0 (2026). Maya Jama CC BY 3.0. Richard E. Grant CC BY-SA 2.0. Jerry Hall CC BY 2.0 (2009). Michael Sheen CC BY-SA 2.0 (2014) |
| US S6 | 12 of 23 in WP's gallery | Dominic Monaghan CC BY-SA 3.0. Kristin Chenoweth CC BY-SA 4.0 |
| Posters | `The Traitors New Blood.png` and `The Celebrity Traitors series 2 poster.jpg` are local **Fair use**, not reusable. The Fandom cast photo is network promo (licence **unknown**) | — |

The reuse terms (attribution, share-alike on crops, personality rights) match the DWTS research.

---

## Implications for the plan
- Two parallel live seasons now: NB on Thursdays at 00:00 UTC (no ep 10/1; finale 11/19 with 2 eps), and Celeb S2 Thu+Fri at 19:00 UTC through about 10/30. US S6 (Peacock, binge drops) and UK S5 (dates **unknown**) follow in early 2027.
- The US "season" can be NBC linear with next-day Peacock. Release times differ by edition and platform. The documented Peacock 9 pm ET drop disagrees with observed edits.
- Wikipedia carries every needed fact, including per-player votes. Top 3 has to be **computed** from per-player cells, because the tally row has counts but no names.
- Wikipedia table columns are round-table/night cycles, not episodes. Episode attribution must come from the header (`3/4`) and the `(Episode N)` text in Finish cells.
- Ties produce 2–3 columns for one round table (vote, revote, Fate). "Top 3 vote-getters" has to pick a round and needs a rule for equal counts.
- Dagger double votes are marked inconsistently: `(2x)` in the US, a footnote in the UK.
- Partial tallies are published mid-reveal. A time window alone can confirm an incomplete round table.
- Spoiler-grade edits appeared about 9 h **before** a Peacock finale drop. Wikipedia data can exist before release.
- Pages are unprotected, have been redirected/blanked for hours, and may be renamed (open move request on NB). Resolve by pageid.
- Latency after the round table airs: UK/BBC about 0–25 min. US NBC 0–3 h. US Peacock about 0–100 min after the observed drop. One volunteer made most of the edits.
- Fandom is CC BY-SA, has a working API and the same data, but was as slow or slower and uses a different template schema.
- Ep 1 (UK celebrity: eps 1–2) has no round table. Some nights have no murder, some have two actions. Recruitment can be declined.
- Headshots: civilians have almost no free images (1/22). Celebrities mostly do (Celeb S2 18/21).

## Key Links / References
- [wpnb]: https://en.wikipedia.org/wiki/The_Traitors:_New_Blood (rev 1377883386)
- [wpcs2]: https://en.wikipedia.org/wiki/The_Celebrity_Traitors_series_2 (rev 1378006453)
- [wpus6]: https://en.wikipedia.org/wiki/The_Traitors_(American_TV_series)_season_6 (rev 1377823985)
- [wpuk]: https://en.wikipedia.org/wiki/The_Traitors_(British_TV_series) (rev 1377988096)
- [wpuk4]: https://en.wikipedia.org/wiki/The_Traitors_(British_TV_series)_series_4 (rev 1374211799). US S4: https://en.wikipedia.org/wiki/The_Traitors_(American_TV_series)_season_4 (rev 1376576846). Celebrity S1: https://en.wikipedia.org/wiki/The_Celebrity_Traitors_series_1 (rev 1378003069)
- [futon]: http://www.thefutoncritic.com/showatch/traitors-new-blood/listings/
- [hr]: https://hiddenremote.com/the-traitors-not-new-tonight-nbc-thanks-baseball-more-bad-news
- [nbcnb]: https://www.nbc.com/nbc-insider/nbc-the-traitors-new-blood-premiere-date-cast-details
- [bbcmc]: https://www.bbc.co.uk/mediacentre/2026/the-celebrity-traitors-series-2-air-date-trailer/ (published 2026-09-15)
- [bbcep]: https://www.bbc.co.uk/programmes/m0030pxs/children.json, https://www.bbc.co.uk/programmes/m0030pxt.json
- [forbes]: https://www.forbes.com/sites/monicamercuri/2026/01/08/what-time-does-the-traitors-season-4-come-out-full-release-schedule/ (quoted via search snippet; direct fetch 403)
- [scots]: https://www.scotsman.com/arts-and-culture/film-and-tv/next-episode-traitors-series-4-full-show-schedule-for-hit-bbc-show-who-has-been-murdered-and-banished-when-does-it-end-5481610
- [techadv]: https://www.techadvisor.com/article/2112744/the-traitors-series-5-uk-news-release-date-contestants-trailer.html
- Fandom: https://thetraitors.fandom.com/api.php (`Template:US5 Voting History` rev 39186), https://thetraitorsuk.fandom.com/api.php
- Revision API: `action=query&prop=revisions&rvprop=ids|timestamp|user|comment|size|tags|content&rvslots=main&rvstart=…&rvend=…&rvdir=newer`

## Open Questions
- [ ] Actual Peacock drop time. Watch the first US S6 drop against the edit history.
- [ ] Pacific-time NBC airing of New Blood (tape delay or live?). This matters for spoilers and gate timing.
- [ ] UK S5 premiere date and cast. Check the BBC Media Centre in November–December.
- [ ] Celeb S2 eps 5–10 dates from a primary source. The BBC JSON lists only eps 1–6 so far, with dates for 1–4.
- [ ] Fandom ToS on API use, and whether the UK Fandom is faster than Wikipedia for Celeb S2. Re-measure after ep 3 (first round table, 10/8).
- [ ] Is Celeb S2 available in the US (Peacock?), and when?
- [ ] Reddit thread latency (not reachable here).
- [ ] Does NBC.com or Peacock expose any structured cast/elimination JSON?
