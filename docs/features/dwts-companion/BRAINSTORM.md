# Brainstorm: DWTS Companion (generic reality-vote app, DWTS first)

Status: Draft, 2026-09-30. Owner: Dom.
Goal: friends rate each dance blind on their phones, see a judges' desk of paddles after submitting, compare against the real judges. Usable within 1-2 weeks, while Season 35 is airing.

Facts about the show come from [`RESEARCH.md`](RESEARCH.md). Anything not there is marked **unknown**.

## The clock

| Date | What |
|---|---|
| Tue 10/6 | Next episode (week 4). 6 days out, too soon to ship |
| Tue 10/13 | Realistic MVP target (week 5) |
| Mon 11/2 | Week 8 airs on a Monday. Also the first show after DST ends (11/1), so 8 pm ET moves from 00:00 to 01:00 UTC |
| Tue 11/17 | Semi-finals. Wikipedia page protection still in force |
| 11/19 02:22 UTC | Page protection expires |
| Tue 11/24 | Finale. Page open to IP editors unless an admin renews protection |

Shipping for 10/13 leaves **7 airings** of this season. That argues for a thin MVP and against anything infra-heavy. Use 10/6 as a dry run: the score poller runs against the live page and logs what it would have published, with no UI. That also answers RESEARCH's open question about the true Wikipedia delay.

## Data sources

### Judges' scores: primary

Wikipedia S35 page through the MediaWiki API. RESEARCH measured one score per dance, 5-12 min apart, on normal weeks.

- **Trigger:** EventBridge Scheduler, `rate(1 minute)`, 8:00-10:30 pm in `America/New_York` on air nights, so DST and the Monday 11/2 show need no special handling. Each tick reads `prop=info` `lastrevid` (one cheap call). It fetches the current week's section only when that changes. That's about 150 calls a night, well inside API etiquette. EventStreams (push over SSE) is faster, but it needs a long-lived process, and Lambda caps at 15 minutes. Deferred.
- **Parse:** key rows by couple name through a per-contestant alias list (`Connor W.`, `Conner L.`), never by row position. Read the judge-order line per week. Handle rowspan multi-dance rows. RESEARCH lists the gotchas.
- **Sanity check before publishing:** each judge value is in 1-10, the values sum to the total, the judge count matches that week's judge line, and the couple is known. A value becomes `confirmed` once it survives 3 minutes or a later revision. RESEARCH saw a vandal edit reverted in 1m46s. This adds about 3 minutes on top of Wikipedia's own delay.
- **Golden fixture:** real wikitext snapshots (S35 wk2-3, S34 wk7-10 for the edge cases) parsed in tests, the same pattern as smirnoff's `fixtures/ices-golden.json`.

### Judges' scores: fallback

Two measured failures can't be automated away: the premiere page was admin-locked with zero live edits, and the finale is exposed to vandalism once protection lapses. Dom won't type scores. The options:

| Fallback | How | Tradeoff |
|---|---|---|
| F1 Delayed fill | Nothing extra. The desk shows the judges' seats as "scores pending" until Wikipedia fills them | Zero work, zero risk of wrong numbers. On a locked night the live experience is gone: premiere scores landed about 2 days late |
| F2 Group reporter | A member flagged as reporter taps the three paddles in from the TV, after submitting their own score. Shown as "reported", overwritten by Wikipedia when a confirmed value arrives | Still a human typing, just not Dom, and only on bad nights. Can be wrong for a few minutes. Needs one reporter watching live |
| F3 Early confirm | When a provisional Wikipedia value exists, an admin taps once to publish it without waiting out the 3 minutes | Cuts latency, but doesn't help availability: on a locked night there's nothing to confirm |
| F4 Second scraper (Today.com live recap) | Parse prose recap updates | ToS risk, brittle prose parsing, single writer. Rejected |

Recommendation: F1 as the default, F2 as an opt-in role. The honest version: on a locked or vandalized night, live judges' scores either come from a friend or come late. Accuracy stats only use `confirmed` values, so a bad report never skews them.

### Roster, headshots, voting

| Need | Source | Note |
|---|---|---|
| Cast, pros, judges, schedule | Seed script from the Wikipedia S35 page | Once, plus eliminations picked up by the poller from the `Result` column |
| Headshots | Wikimedia Commons, with an attribution page (author, license, source link). BY-SA crops published under BY-SA | Covers 10/16 celebs (several 10+ years old), 7/16 pros, all 3 judges. The rest get an initials or silhouette placeholder. Couple cards must look fine with two placeholders |
| ABC widget JSON (`widgetstate.votenow.tv/...`) | Backend read for the voting-window flag and vote limits only | Undocumented, Disney ToS. **Do not** use its couple images: ABC copyright, no license. The clock fallback for the window is 8-10 pm ET on air nights |
| SMS vote | `sms:21523` with the couple's keyword as the body, 10 per couple | Keywords are published on the FAQ only when voting opens. **Unknown** whether the widget JSON carries them. SMS is US-only |
| Web vote | Link to `dwtsvote.abc.com` | No per-couple deep link exists (RESEARCH, inference) |
| History S1-S34 | Same Wikipedia parser | About 6 format special cases. The live parser does most of the work, so backfill is cheap once it's solid |

**Voting window constraint:** votes count only during the live ET/CT broadcast. The vote button appears only while the window is open. A delayed viewer (Pacific, DVR) sees "Voting closed. Votes only count during the live Eastern broadcast" instead. The button is not a spoiler, since the window says nothing about results.

### Scoring shapes the model must take

From RESEARCH Q5. MVP handles the first five and stores the rest without rating them.

| Case | Model |
|---|---|
| 3 judges, 30 max | `score` row per judge per performance |
| Guest judge (4, 40 max), absent judge (2, 20 max) | `panelist` rows per episode. The desk renders however many seats there are |
| Multi-dance weeks | performance keyed `episode + contestant + ordinal` |
| Two-night week | `episode` carries a `week` number. They don't line up |
| Half points | judge values stored as decimals. User paddle stays whole 1-10 |
| Team dance (one score, several couples) | `performance.contestants[]`. Rated once. MVP: shown, not rated |
| Bonus points (marathon, relay) | stored on the episode per contestant. Not rateable, excluded from accuracy |

Accuracy compares the user's paddle with the **mean judge value** for that dance, so 2, 3 and 4-judge nights compare on the same 1-10 scale.

## Phase 1 — Explore

Auth / identity
- Shared Xomware Cognito pool + Google (smirnoff-league pattern, `frontend/lib/auth/amplify.ts`)
- Cognito + Sign in with Apple
- Username + password, JWT cookie (what derby's code does now: `derby/backend/lambdas/auth_signup/handler.py`. Its README still says magic link, so the README is stale)
- Magic link via SES (SES sandbox and production-access overhead)
- No account: invite link, name, device token in localStorage
- No account now, "claim with Google" later

Live updates
- Poll one aggregated `episode state` endpoint every 10s while visible
- Version number / ETag so unchanged polls are cheap
- API Gateway WebSocket API + connections table + fan-out Lambda
- AppSync Events (managed pub/sub)
- Judges' scores as static JSON on CloudFront, off the regional WAF. It doesn't survive the gate: a public file lets anyone skip it
- Pull-to-refresh only

Blind gating
- Server-enforced: the API withholds every score for a performance until the caller has a score row for it
- Client-only hiding (public bundle, trivially bypassed)
- Skip ("missed it") reveals as an abstain
- Lock on submit

Desk visual
- Parametric SVG + CSS: desk, seats, head (Commons photo, profile photo or initials), arm, numbered paddle, raise transition
- Layered illustrated art with the photo head composited
- Rive / Lottie animation
- Canvas / WebGL (overkill)

Stack
- Derby-style monorepo (Next.js static export, Python Lambdas, DynamoDB, Terraform via Actions)
- Angular three-repo product template
- Premise check: memory says event-pool apps get the derby monorepo and product apps get Angular. This app is a hybrid: event-shaped (weekly airings, watch parties) but long-lived and multi-show later. Derby wins on the clock, and smirnoff already solved the phone shell, Cognito and the cron inside that template.

Things the brief didn't say that matter
- **The TV shows the judges' paddles right after each dance.** A live viewer has seconds between the dance ending and the reveal, so input must be two taps. The blind gate can't stop someone who already saw the TV. Accuracy is honor-system.
- **Spoilers go beyond scores.** For a delayed viewer, an "eliminated" badge, the accuracy table, a season chart and the Wikipedia running order all leak results. Episode-level results (eliminations, totals, leaderboard movement) stay hidden until the user has scored or skipped every dance in that episode. Couples show in alphabetical order until the user reveals, matching the pre-show Wikipedia table.
- **The running order is only known as the show airs.** Wikipedia reorders the table live. A user must be able to open a performance by tapping a couple before any source knows it exists. The poller attaches style and scores to the same `episode + contestant + ordinal` key.
- **A watch party behind one NAT IP** shares the regional WAF budget: 2000 req / 5 min per IP, across all Xomware APIs. Worked below.

## Phase 2 — Converge

Shared by every option (not a differentiator):
- Derby-style monorepo, own repo. Next.js static export on S3 + CloudFront, Python Lambdas behind API Gateway, DynamoDB PAY_PER_REQUEST, Terraform only in GitHub Actions.
- Generic model, no multi-show features: `show / season / episode / contestant (members[]: celebrity, pro) / panelist / performance / score (rater kind judge|user)`, plus `group`, `membership`, `user`. A couple is one contestant with two members, which also covers solo-contestant shows later.
- Data pipeline above. Server-enforced blind gate. Scores locked on submit.

WAF math (one IP, 2000 req / 5 min = 400/min, shared with any other Xomware app open on that wifi):

| Phones | Poll interval | Requests / 5 min | Headroom |
|---|---|---|---|
| 8 | 10s | 240 | plenty |
| 15 | 10s | 450 | fine |
| 15 | 3s | 1500 | one burst from a 429 |
| 25 | 5s | 1500 | same |

One aggregated endpoint, 10s while visible and live, 60s otherwise. Headshots and the bundle come from CloudFront, under the separate CloudFront ACL. The server-side pollers (Wikipedia, ABC widget) don't touch the WAF.

Since judges' scores arrive 4-15 min after a dance (Wikipedia delay plus 3-minute confirm), live-update latency to the phone matters mostly for **friends'** paddles. That weakens the case for WebSockets further.

### Option 1: Party Pass (no accounts)

**What**: Join from an invite link, pick a name, get a device token. No sign-in.

**How it works**: The invite link carries a group code. First open creates a user and returns a random long-lived token kept in localStorage and checked by a small Lambda authorizer. Polling, SVG desk.

**Pros**:
- Fastest build and onboarding: tap link, type name
- No change needed in `xomware-infrastructure`

**Cons / Risks**:
- Identity lives in one browser. Voting from the Mac (a stated use) becomes a second person unless a link-device flow gets built, which is accounts by another name
- Cleared Safari storage loses the season's history
- Real accounts later need a claim flow and a second auth path
- A custom authorizer to own

**Best if**: it's a one-season toy and nobody uses a second device.

### Option 2: Xomware Standard (Cognito + polling + SVG desk)

**What**: Shared Xomware Cognito pool with Google (Apple if cheap), 10s polling of one episode-state endpoint, parametric SVG desk.

**How it works**: Copy smirnoff-league's auth: pool and app client in `Xomware/xomware-infrastructure/terraform/cognito.tf`, pool ARN from SSM, native `COGNITO_USER_POOLS` authorizer on every route. `GET /episodes/state` returns the caller's group view. Each performance is either `locked` or revealed (own score, friends', judges' with `confirmed`/`reported`/`pending`), plus a version for cheap no-change polls. The desk is an SVG component: one seat per `panelist` that night (2-4), then the user, then friends in submit order, with a CSS paddle raise.

**Pros**:
- One identity across phone and Mac; history survives devices
- Nearly every piece already runs in smirnoff-league or derby
- Real accounts are what a multi-show product needs anyway
- Polling fits the WAF budget and has no connection state to debug on show night

**Cons / Risks**:
- Friends must sign in with Google (or Apple). Some may balk
- The new app client is a PR in a second repo before end-to-end works
- Friends' paddles appear up to 10s late. Fine in a room
- The SVG desk needs real design time to not look cheap, and it's the signature visual

**Best if**: it's meant to outlive this season, which the generic name says it is.

### Option 3: Live Room (Cognito + WebSockets + animated desk)

**What**: Option 2's auth, with push over WebSockets and a Rive-animated desk.

**How it works**: Score writes fan out "performance X changed" to connected group members over an API Gateway WebSocket API (or AppSync Events). Each client then fetches its own gated view. The desk is a Rive state machine (idle, raise, reveal) with the head image and number fed in at runtime.

**Pros**:
- Friends' paddles pop in instantly; best across cities
- A truly animated signature visual

**Cons / Risks**:
- Extra infra (WebSocket API, connections table, fan-out Lambda) plus reconnects on phones that sleep mid-show
- **Unverified** whether the shared regional WAF attaches to a WebSocket API
- Rive is a new tool and asset pipeline
- Judges' scores are minutes behind anyway, so push only speeds up friends
- Doesn't fit before 10/13

**Best if**: groups watch in different cities and live pop-in turns out to be the draw. Revisit for next season.

### Side by side

| | Option 1 Party Pass | Option 2 Xomware Standard | Option 3 Live Room |
|---|---|---|---|
| Auth | device token | Cognito, Google (+Apple) | Cognito |
| Phone + Mac | no | yes | yes |
| Live mechanism | 10s poll | 10s poll | WebSocket push |
| Desk visual | SVG | SVG + CSS | Rive |
| New infra vs template | custom authorizer | Cognito client PR | WebSocket stack |
| Ready by 10/13 | yes | yes, tight | no |
| Path to multi-show | rewrite auth | none needed | none needed |

### Name / domain ideas

Availability of every one is **unverified**. Nothing was checked. DWTS lives at `dwts.<domain>`.

| Name | Domain idea | Note |
|---|---|---|
| Fourth Chair | fourthchair.app | You take the seat beside three judges. Slightly off on guest-judge weeks, when a real fourth judge sits there |
| Armchair Judge | armchairjudge.com | Says what it is; generic across shows |
| Couch Panel | couchpanel.com | Group-first framing |
| Paddle Up | paddleup.app | Ties to the signature visual; weaker for non-paddle shows |
| Xomjudge | xomjudge.com | Fits Xomify/Xomper naming; fallback `judge.xomware.com` if registration drags |
| Home Panel | homepanel.tv | Generic, `.tv` suits the category |

## Phase 3 — Recommendation

**Option 2, Xomware Standard**, with Wikipedia as the judges' source and F1 + F2 as the fallbacks.

The Mac-voting requirement kills Option 1: a device token doesn't follow you to the second screen, and fixing that means building accounts anyway. Option 3's payoff is instant friends' paddles, but it's small next to its show-night failure modes and the 7-airing runway. It stays a next-season candidate.

It depends on one thing: **whether Dom's friends will sign in with Google or Apple.** If several won't, swap only the auth to derby's username + password JWT cookie (`derby/backend/lambdas/auth_signup/handler.py`). That still works across devices without OAuth, and the rest of Option 2 stands.

### Thin MVP (target Tue 10/13; 10/6 is the poller dry run)

In:
- Sign in, create a group, join by invite link
- Seed script: S35 cast, pros, judges, remaining episodes and aliases from Wikipedia. Commons headshots with attribution, initials placeholders for the rest
- Episode screen: couples as cards, alphabetical. Tap a couple, pick 1-10 on a paddle row, submit, locked. Skip reveals as abstain
- Reveal: the desk with a seat per judge that night, you, and friends. Judges' seats show `pending`, `reported` or `confirmed`
- Episode-level spoiler gate for eliminations and totals
- Wikipedia poller with sanity checks, 3-minute confirm and golden fixtures. Reporter role (F2)
- Vote button, live window only: `sms:21523` with the keyword, a per-couple 0-10 counter, and the `dwtsvote.abc.com` link. Closed state for delayed viewers
- One stats view: per-episode accuracy vs the judges' mean, group table

Deferred:
- Progression charts, me vs judges vs friends over time, style filters
- Past seasons S1-S34 (parser reuse, about 6 format special cases)
- EventStreams trigger, early-confirm (F3), WebSockets, Rive
- Notifications (spoilers for delayed viewers unless designed carefully)
- Team dances and bonus rounds as rateable items
- Any second show

Rough slices for `/plan` to refine (logic lines only):

| # | Slice | Size | Needs | By |
|---|---|---|---|---|
| 1 | Wikipedia parser + golden fixtures (pure function, no infra) | ~200 | - | 10/6 |
| 2 | Repo from derby template, Terraform stack, Cognito client PR | infra + ~50 | - | 10/6 |
| 3 | Poller Lambda + scheduler, log-only dry run | ~120 | 1, 2 | 10/6 |
| 4 | Tables + seed script (cast, aliases, panelists, episodes, headshots) | ~150 | 2 | 10/13 |
| 5 | Groups: create, invite, join | ~150 | 2 | 10/13 |
| 6 | Score submit + gated episode-state endpoint + gate tests | ~200 | 4, 5 | 10/13 |
| 7 | Phone UI: episode screen, paddle picker, polling | ~250 | 6 | 10/13 |
| 8 | Desk visual | ~200 | 7 | 10/13 |
| 9 | Poller publishes (confirm window, reporter role) | ~120 | 3, 6 | 10/13 |
| 10 | Vote button + window + accuracy table + episode spoiler gate | ~150 | 6 | 10/13 |

Slices 1 and 3 go first. They're the only things Dom can't redo by hand, and 10/6 is the one free live night to test them against.

## Open questions for Dom

1. How many people in the first group, and do they watch in one room (one IP) or spread out? Any Pacific or next-day viewers?
2. Will they sign in with Google? Apple? Any Android users (the `sms:` link syntax differs by platform, **unverified** which)?
3. Who is the reporter on a locked night? Is "judges' scores arrive later" acceptable if nobody is?
4. SMS keywords appear only when voting opens. Is Dom (or a reporter) entering 12 keywords once a season acceptable? It isn't score entry, but it is typing. The alternative is parsing the FAQ page, format **unknown**.
5. Lock on submit, no edits ever. Agreed?
6. Skip reveals without a score. Does it count against accuracy?
7. Accuracy vs the judges' mean. Or per judge, or "closest judge" as a fun extra?
8. User avatar: uploaded photo, Google profile photo, or a drawn character? The desk look depends on it.
9. Spoiler scope: hiding eliminations and totals until you finish the episode. Right, or too strict for live viewers?
10. Can users rate earlier S35 episodes they missed (weeks 1-3, blind, after the fact)?
11. Buy a domain now, or launch on a `xomware.com` subdomain and move later?
12. Repo visibility: public in the Xomware org per convention, with friends' names and scores kept out of git?
