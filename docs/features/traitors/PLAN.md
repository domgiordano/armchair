# Plan: Traitors

**Status**: Ready
**Created**: 2026-10-02
**Last updated**: 2026-10-02 (Dom's answers applied)

## Summary
Friends predict The Traitors while they watch: the ranked top 3 at each round table, who is murdered and who is recruited each night, and up to three season winners. Predictions are blind and final, exactly like DWTS: no one sees anyone's picks or the results until they lock their own. Points feed global, friends and group leaderboards, per season and all-time. US and UK share one app with an edition toggle. It lives at `traitors.armchairjudge.com` with its own gaudy, fire-lit castle design and a hooded-figure intro, and keeps DWTS's history, people and search pages.

**Target.** The poller runs a log-only dry run on Thu 10/8. Picks go live Thu 10/15. Both live shows air every Thursday (New Blood to 11/19, Celebrity S2 Thu+Fri to about 10/30). Future seasons are discovered and seeded without code changes.

## Decisions (Dom, 10/2)
| Topic | Decision |
|---|---|
| Visibility | DWTS rules exactly. You can pick at any time. Nothing locks on a clock. Results, others' picks and consensus stay hidden until you enter your own pick |
| Already-aired episodes | Episodes released before a season goes live in the app (New Blood 1-4) and every past season are **closed**: results shown, no picks |
| Design | A new frontend design, entirely Traitors-themed: gaudy, fire, castle. Only non-visual code is shared with DWTS. Direction comes from [`DESIGN-RESEARCH.md`](DESIGN-RESEARCH.md) |
| Name | **Traitors** |
| Points | As proposed (table below) |
| Winner bet | Required before **picking** anything in a current season; browsing is open (Dom, later) |
| Results | Fully automated from the internet. No hand entry |
| Headshots | Found through image search, like the DWTS supplied photos. Not limited to Commons |
| Future seasons | Must work with no code change: catalog-driven poller plus automatic season discovery |

## Approach
Reuse the DWTS backend architecture: same repo, API, user pool, social tables and gate pattern. Add a pick model, a points board, a Wikipedia voting-table parser, season discovery, and a third static site with its own design. The facts come from [`RESEARCH.md`](RESEARCH.md).

**What carries over.**
- **Keys.** Every table key already has a show slot (`SEASON#{show}#{n}`, `EP#{show}#{n}#{ep}`, `BOARD#{show}#…`), and `episodes_dynamo.py:18` parses `<show>-<n>` generically.
- **Family-level tables.** Users, friends, groups and notifications.
- **Unchanged plumbing.** The API module, warmer, layer, `?sso=1` handoff and the shared deploy workflows.

**What doesn't.**
- Seven handlers hardcode `dwts` (`leaderboard_get:36`, `seasons_list:21`, `people_get:38`, `people_search:26`, `users_get:61`, `performers_get:56`, `cron_poll_wiki:33`). The shared ones take a `show` param.
- The board stores paddle error. Traitors gets a points shape under the same `BOARD#` keys.
- `gate.py` is about performances and judges. A new `traitors_gate.py` applies the same rules to events.

### Editions as shows
| Slug | Edition | Seasons |
|---|---|---|
| `tus` | The Traitors US | 1-4 closed; **5 = New Blood, live (eps 1-4 closed)**; 6 early 2027 |
| `tuk` | The Traitors UK | 1-4 closed; 5 TBA |
| `tukc` | The Celebrity Traitors UK | 1 closed; **2 live** |

The toggle is US / UK, and UK's season picker lists both series. Season ids look like `tus-5` or `tukc-2`. The edition slug matters because UK civilian and celebrity series are numbered independently.

### Events
Every episode offers the same slots, so the list itself can't spoil anything:

| Slot | Pick | Offered |
|---|---|---|
| `RT` round table | ranked 1st, 2nd, 3rd from active players | every episode except those the schedule marks `noRoundTable` (ep 1 everywhere, Celebrity eps 1-2) |
| `MURDER` | one active player | every episode |
| `RECRUIT` | one active player, optional | every episode, so its presence never hints at a recruitment night |

If the event doesn't happen, the pick voids: 0 points, no penalty. Edge-case rules:
- **Tie and revote.** Top 3 ranks by the **first** vote column. Slot 1 scores against whoever actually left, after any revote or Fate draw.
- **Equal counts** (`5-2-2`). Tied players share the rank, so either pick is exact.
- **Dagger.** Doubles that voter's count. The US marks it `(2x)`; the UK marks it with a `{{efn|name=Dagger}}` on the voter's cell. The parser handles both.
- **Two round tables in one episode.** Only the first is picked; the second is shown as a result.
- **Round table straddling episodes** (`3/4`). Belongs to the episode where the banishment airs.
- **Two murders, or a recruit plus a murder.** Any victim matches `MURDER` and any recruit matches `RECRUIT`. A declined offer still counts as the Traitors' choice.
- **End game.** End-game votes are a result, not a pick. The winner bet covers the finale.

### Winner bet
- On first entering a current season you are asked to pick 1 to 3 winners and, for each, whether they win as a Faithful or a Traitor.
- The bet is final. Without it you can browse the season, but every open event stays locked and nothing can be picked.
- The multiplier is `(E - r) / E`, where `E` is the episode count and `r` the episodes already released when you lock. A bet made before the premiere is worth full points.

### Points (confirmed)
| Call | Points |
|---|---|
| RT #1 = banished | 5 |
| RT #2 exactly 2nd / #3 exactly 3rd | 3 / 2 |
| RT any pick in top 3, wrong slot | 1 |
| Murder victim | 4 |
| Recruit | 4 |
| Winner, per correct pick (up to 3) | 20 × multiplier |
| Winner's faction, per correct pick | +10 × multiplier |

Leaderboards rank by total. Ties go to more correct banishments, then to the earliest first pick. A per-event average is shown beside the total.

### Results: Wikipedia poller, no hand entry
Wikipedia was the fastest structured source measured: about 25 min after the round table airs for UK, 0-3 h for NBC (RESEARCH Q3-Q4). The poller adds three guards DWTS didn't need:
1. **Complete, then stable.** A column's per-player votes must sum to its `Vote` row total, and `Banishment` must be filled, before the 180 s confirm clock starts. Editors type partial tallies in mid-reveal.
2. **Release-time guard.** Nothing confirms before the episode's catalog `releaseAt`. Finale cells once appeared 9 h before a Peacock drop.
3. **Pageid, not title, plus a size guard.** New Blood was redirected twice and has a move request open. A page under 5 KB, or one with no elimination table, is logged and skipped.

**Window.** One `aws_scheduler_schedule` runs every minute. Each tick does one catalog Query for `current` seasons and polls only those with an episode released in the last 6 h, plus an hourly sweep for 72 h after. Every Thursday and the Friday UK nights are covered by data, not cron expressions.

**Future seasons** (`cron_discover_traitors`, daily):
- Reads each edition's main article's season list (`The Traitors (American TV series)`, `…(British TV series)`, `The Celebrity Traitors`). That's how a renamed season like *New Blood* is still found.
- Seeds any season page that has a contestants table and an episode table with dates.
- Flags the season `current` 7 days before ep 1 and unflags the previous one, which closes it.
- Release times come from the episode table's dates plus a per-edition default time and zone (NBC Thu 20:00 ET, Peacock drop, BBC 20:00 UK). Each default can be overridden per season. The Peacock drop time is **unknown** (RESEARCH open question 1) and gets set from the first US S6 drop.

### Gate (`common/traitors_gate.py`, server-side only)
1. An event's results, other users' picks and the consensus ("62% had Madeline first") show only after the caller has picked or forfeited that event.
2. Episode results (banished, murdered, recruited, factions, vote counts) show only once every event in that episode is answered.
3. Stats and leaderboards count only events the caller has answered, and show aggregates only.
4. Submit is a conditional put. An identical retry returns 200; a different pick returns 409.
5. **Closed** episodes and past seasons are open to everyone and view-only. Submit returns 403.
6. A current season can be browsed before the caller's winner bet (`needsBet: true`, every open event locked). Submit returns 403 until the bet exists.
7. The active roster for episode N reveals N-1's exits. This is the same accepted leak as DWTS, with the same catch-up interstitial.

### Data model
No new tables.

| Table | pk | sk | Item |
|---|---|---|---|
| catalog | `SEASON#{show}#{n}` | `META` | `pageid`, `edition`, `episodes`, `current`, `releaseDefaults`, `summary: {text, sourceUrl}` (article lead, CC BY-SA) |
| | | `EP#{nn}` | `releaseAt` (UTC), `closed`, `noRoundTable`, gated `recap: {text, source, sourceUrl}` (Wikipedia ShortSummary, else the Fandom episode page; `traitors_about.py`) |
| | | `PLAYER#{cid}` | `name`, `aliases[]`, `headshot`, `article`, `about: {age, hometown, occupation}`, `bio: {text, source, sourceUrl}` (Wikipedia, else Fandom, else the network's cast page), `bioCut`; gated `faction`, `exit: {ep, how}` |
| performances | `EP#{show}#{n}#{nn}` | `EVT#{RT|MURDER|RECRUIT|SHIELD}` | event result plus confirm state (`confirm.py`); RT also `ballots: {voter: target}`, `daggers[]`, unscored |
| scores | `EP#{show}#{n}#{nn}` | `EVT#{type}#USER#{sub}` | `picks[]` (ordered) or `forfeit`, `submittedAt` |
| scores | `WIN#{show}#{n}` | `USER#{sub}` | `picks: [{cid, faction}]`, `released` (multiplier basis) |
| board | `BOARD#{show}#{n|all}` | `USER#{sub}` | `pts`, `events`, `banishHits`, `firstAt` |
| board | `PTS#{show}#{n}#{nn}` | `{evt}#USER#{sub}` | one counted event, written in the same transaction as the `ADD` (`board_dynamo.py:58-103` pattern) |

### Headshots
- `scripts/find_traitors_headshots.py` gets candidates per player from an image search API, then from Commons.
- It face-crops them with the existing `faces.py` and writes an HTML contact sheet. Dom eyeballs the sheet, and the script uploads the approved crops to `headshots/supplied/` in the site bucket. This is DWTS's existing `"source": "supplied"` path.
- Only the registry (name, file, `sourceUrl`) is in git, never the images.
- **Unknown:** which search API. Google's Custom Search JSON API may be closed to new keys; checking it is the first step of PR 11, with Brave Search's image endpoint as the fallback. The API key goes in SSM, never in git.
- These are network and press photos, which DWTS's supplied path already accepts. The credits page lists each `sourceUrl`.

## Frontend
`traitors/` is a third static Next app (Next 16, Tailwind 4, R3F, static export).

**Shared logic, not looks.** PR 1 moves DWTS's **non-visual** code into `packages/app-core` (npm workspace, `transpilePackages`): Amplify config and auth hooks, silent SSO, the session hint, the API client and cache, the polling hook, the social, notifications and groups API modules, and their types. It's a pure move with zero behaviour change. Every component, token, font and animation in `traitors/` is new.

**Design.** This adopts the "Design direction" section of [`DESIGN-RESEARCH.md`](DESIGN-RESEARCH.md); the token table is there.
- **Palette.** Green-black `night`/`stone` grounds and `cloak` green surfaces. `candle` gold marks anything worth points. `blood`/`oxblood` are reserved for Traitor. Body text is `parchment` (14.3:1).
- **Type.** Cinzel for headings, EB Garamond for body. Cinzel Decorative appears only on the title card and the Faithful/Traitor reveal word. Names chalked on the slate use Caveat.
- **Gaudy, the way the hosts are.** Our own red, black and green tartan (not a registered sett), gilt frames, velvet-dark surfaces.
- **Motifs.** The ballot is a slate with ranks I/II/III. Every final pick locks with the same wax-seal stamp. A reveal is a hood drop, then *Faithful.* or *Traitor.* burns in. A murder result is an empty breakfast chair with its candle out. A red cloak marks rare things, like the winner bet or a perfect week.
- **Fire on a budget.** At most 4 flickering point lights, drei `Sparkles` embers, Bloom and `PerformanceMonitor`. 2D screens use CSS flicker. Reduced motion gets a static glow.
- **Clean room.** None of the show's logo, wordmark or official artwork, and a "not affiliated with" footer line. The plan's intro already avoids faces. The research adds:
  - top-down table OK; never the franchise compass emblem (8-point star + crescent hub + moon-phase ring)
  - no "Murrrder" styling
  - no breakfast-letter wording
  - no show audio
  - CC0 assets first, CC-BY only with an entry on the Credits page
  - no emoji glyphs

**Intro.** Same skeleton as `frontend/components/intro.tsx`: poster first frame, lazy scene, 2D fallback, 8 s patience, Skip, skipped under reduced motion, plays on every signed-out load.
1. Torch-lit stone corridor, with point-light fire flicker and embers.
2. Hooded figures in deep-green cloaks walk toward the camera. The hood interiors are pure black, and no face is ever modelled.
3. They reach the round table, and the camera pushes in on the lead figure.
4. The hood falls back to reveal a void, and **Traitors** fades in where the face would be. Hand off to the landing.

The loader is the same faceless hooded silhouette.

**Screens.** Overview, Episodes, Leaderboard, Stats, Players, Discover, plus the winner-bet gate on season entry.
- **Episode.** A slate ballot: rank 3 for the round table, single picks for the night, then a wax-seal confirm.
- **Reveal.** Your picks against the result, points, a consensus bar and friends' picks.
- **Stats.** Points by event type, banishment and murder hit rates, trend, best calls, you against the consensus.
- **History.** Closed seasons and episodes render the voting table. Player pages and search reuse `people_*` with `show`.

## PR decomposition
Logic lines only. **DRY** = needed for the 10/8 dry run. **CP** = 10/15 critical path.

| # | Repo | PR (one idea) | Logic | Needs | Path |
|---|---|---|---|---|---|
| 0 | xomware-infrastructure | `armchair-traitors-client` (Google, callbacks `traitors.armchairjudge.com` + localhost) and SSM `/armchair/shared/cognito/clients/traitors-id` | ~0 | — | CP |
| 1 | armchair | Mechanical: extract non-visual frontend code to `packages/app-core`; DWTS imports it, no behaviour change | ~0 (move) | — | CP |
| 2 | armchair | Shared handlers take `show`, defaulting to `dwts` | ~40 | — | CP |
| 3 | armchair | `common/traitors_parse.py` + golden fixtures: grid, columns to events, first-vote top 3, ties, revote, Fate, both dagger markups, decisions, exits, end game, winners, plus the episode table and release dates | ~250 | — | DRY |
| 4 | armchair | Seeder: `seed_traitors_season.py` (roster, aliases, `releaseAt`, `closed`, `pageid`, edition defaults); seed `tus-5` and `tukc-2` | ~150 | 3 | DRY |
| 5 | armchair | `cron_poll_traitors` log-only: catalog-driven window, pageid fetch, size guard, structured log per tick | ~120 | 3, 4 | DRY (applied by Wed 10/7) |
| 6 | armchair | Site: `var.traitors_domain_name`, `web-hosting` instance, CORS, deploy-role ARNs, `deploy-traitors.yml`, blank `traitors/` app with sign-in | ~60 | 0, 1 | CP |
| 7 | armchair | Picks + gate: `traitors_gate.py`, `picks_submit`, `winner_submit`, `traitors_episode_state`, gate suite | ~220 | 4 | CP |
| 8 | armchair | Points: `common/points.py` (pure), `PTS#`/`BOARD#` writes, reconcile on publish, winner settlement | ~180 | 7 | CP |
| 9 | armchair | Poller publishes: completeness, 180 s confirm, release-time guard, reconcile | ~150 | 5, 8 | CP |
| 10 | armchair | `cron_discover_traitors`: season discovery, seeding, `current` flip | ~150 | 4 | before Celeb S2 ends (~10/30) |
| 11 | armchair | Headshots: search API check, `find_traitors_headshots.py`, contact sheet, supplied upload; run for `tus-5`, `tukc-2` | ~150 | 4 | CP (initials until then) |
| 12 | armchair | Design system: tokens, fonts, fire and ember backgrounds, slate, wax seal, cards, buttons, sheets; app shell with edition toggle and season picker | ~300 (UI kit) | 6 | CP |
| 13 | armchair | Season entry: winner-bet gate screen, episode list, catch-up interstitial | ~200 | 7, 12 | CP |
| 14 | armchair | Ballot + reveal: slate RT ranking, night picks, seal confirm, reveal with points, consensus, friends, polling | ~250 | 13 | CP |
| 15 | armchair | Leaderboard + stats (Traitors branch of `leaderboard_get` / `stats_get`) | ~200 | 8, 12 | 10/15 target, first to slip |
| 16 | armchair | Intro + loader: corridor, hooded walkers, fire, hood-drop title reveal, 2D fallback | ~300 (art) | 12 | 10/15 target; a static landing ships until then |
| 17 | armchair | History: seed US1-4, UK1-4 and Celeb S1 closed; voting-table view, player pages, search | ~200 | 3, 4, 13 | after 10/15 |
| 18 | armchair | Hub: Traitors goes live in `apps-menu`, `apps-panel` and `shows.tsx`, with a show switch on hub stats and leaderboards | ~100 | 15 | after 10/15 |

**Why this order.**
- 3-5 are the only pieces with a hard date, and they're pure Python plus one Lambda.
- 1 lands before 6, so the new app starts on the shared package.
- The gate (7) lands before anything publishes results (9), the same reason DWTS ran PR 8 before PR 10.
- Discovery (10) has to exist before the next season starts, not before 10/15.

### Test plan
- **Parser golden.** Expected output is hand-written and never computed by the parser. Cases:
  - the 34 researched round tables, including UK4 ep 10's footnote dagger
  - the NB 9/25 01:04 UTC partial tally, which must not count as complete
  - the 149-byte redirect, which must be skipped
  - the US S4 pre-release finale edit, which the release guard must block
- **Discovery.** Fixtures of each edition's main article. A renamed season (New Blood) is found. A season page with no cast yet is skipped. `current` flips at T-7 days.
- **Points.** Every row of the table, shared ranks, revote, Fate, a void night, recruit plus murder, a declined recruit, the multiplier at `r = 0` and `r = E - 1`.
- **Gate.** The DWTS gate suite translated to events, plus: closed episodes are open and return 403 on submit, and episodes return 403 until the winner bet exists.
- **Manual.** Walk each UI PR on an iPhone against the deployed site. On 10/15, a second account must not see the first account's picks before answering.

## Deferred
- Fandom API as a second source, for when the Wikipedia page is blanked or redirected. It has the same data under CC BY-SA but measured slower (RESEARCH Q4).
- End-game votes and second round tables as pickable events.

## Out of Scope
- Hand entry of results.
- Show logos, wordmarks, theme music, official artwork.
- Friends' data in git.

## Risks / Tradeoffs
- **Honor system**, as with DWTS. Someone who has seen the episode can pick after it airs.
- **Wikipedia is the only source, and one editor writes 55-79% of the table edits.** If they stop, or the page is blanked, results wait. That's the trigger for the deferred Fandom fallback.
- **Release defaults can be wrong** (the Peacock time is unknown). A wrong default only shifts when results confirm, because the per-user gate still hides them.
- **Supplied headshots are press photos.** That's DWTS's accepted practice; only the registry is in git.
- **The name "Traitors" sits close to the show's own title.** It's used descriptively, with the not-affiliated footer.
- **The 3D intro is the riskiest UI piece**, so it stays off the critical path.

## Open Questions
- [ ] 1. Image search API: Google CSE if it still issues keys, else Brave. Is a paid key OK if neither free tier works?
