# Plan: DWTS Companion (working name `armchair`)

**Status**: Ready
**Created**: 2026-09-30
**Last updated**: 2026-09-30

## Summary
Friends rate each Dancing with the Stars performance 1-10 on their phones. Answers are blind and final. After answering they see how the real judges and every other user scored it, and how accurate they were. Success means it's live at `dwts.xomware.com` for the Tue 10/13 show (week 5), after a log-only Wikipedia poller dry run on Tue 10/6. Friends sign in with Google and score without typing anything else.

## Approach
This is Option 2, "Xomware Standard", from [`BRAINSTORM.md`](BRAINSTORM.md), with Dom's decisions of 2026-09-30 applied on top. Show facts come from [`RESEARCH.md`](RESEARCH.md). Anything with no file or research source behind it is marked **unknown**.

**Where Dom's decisions override the brainstorm**

| Topic | Brainstorm | Now |
|---|---|---|
| Visibility | Group-first desk | All users' scores are global by default. A group is a filter over users. Anyone can create one |
| Gate | Per performance, per caller | Same, applied to everything: global, group and judges' scores and every stat. The rule holds no matter when you watch |
| Auth | Shared `xomware-users` pool | **New dedicated pool** for the voting-show app family. Google only |
| Accuracy | vs judges' mean | vs the mean **and** vs each judge individually |
| SMS keyword | Typed in by Dom or a reporter | Derived automatically from the celebrity's first name, first name + last initial on a clash. Admin override only when needed |
| Reporter (F2) | In the MVP | Moved after the MVP, due before the semi-final (see Deferred) |
| Repo | Xomware org | Public, `domgiordano/<repo>` |

**Working name.** Code uses `armchair` until Dom picks the family domain. It comes from "Armchair Judge", a brainstorm name idea: generic across voting shows and unlikely to collide with existing resource names in the account. It becomes the resource prefix (`armchair-*` tables and Lambdas, `/armchair/*` SSM, the `armchair-users` pool) and the repo name (`domgiordano/armchair`). A prefix that doesn't match the public name has precedent: `reeses` serves `playoffs.xomware.com` and `xomcron` serves `crons.xomware.com` (`xomware-infrastructure/terraform/cognito.tf`). **The domain is config; the prefix is effectively permanent**, because DynamoDB tables and Cognito pools can't be renamed.

**Stack.** A derby-style monorepo, copied from smirnoff-league, the newest instance of the pattern:
- Frontend: Next.js static export → S3 + CloudFront via `domgiordano/web-hosting` `v1.4.0` with `enable_subroute_rewrite = true` (`smirnoff-league/infrastructure/terraform/web_hosting.tf`). Next 16 + Tailwind 4 + vitest (`smirnoff-league/frontend/package.json`). `output: 'export'`, `trailingSlash: true` (`derby/frontend/next.config.ts`).
- Backend: Python 3.12 Lambdas behind `domgiordano/api-gateway-service` `v2.8.0` with a `COGNITO_USER_POOLS` authorizer on every route (`smirnoff-league/infrastructure/terraform/api_gateway.tf`). **The module supports exactly two path levels, `/<prefix>/<part>`** (`smirnoff-league/infrastructure/terraform/lambda.tf:1`), so ids go in the query string or body. Handlers use the `{ data, error, meta }` envelope and the claims helpers in `smirnoff-league/backend/lambdas/common/api.py`.
- Storage: DynamoDB `PAY_PER_REQUEST`, KMS CMK, PITR, deletion protection, no GSIs (`smirnoff-league/infrastructure/terraform/dynamodb.tf`).
- WAF: shared regional ACL from SSM `/xomware/shared/regional-waf-acl-arn`, associated to the API stage (`derby/infrastructure/terraform/waf.tf`). The limit is 2000 req / 5 min per IP (`xomware-infrastructure/terraform/waf.tf:22`). The brainstorm's WAF math sets the poll rate: 10s while visible and live, 60s otherwise.
- State: `s3://xomware-terraform-state/armchair/terraform.tfstate` with the `xomware-terraform-locks` table (`smirnoff-league/infrastructure/terraform/main.tf`).
- CI/CD: copy smirnoff's `terraform.yml`, `deploy-backend.yml`, `deploy-frontend.yml`, `test-backend.yml`, `ci.yml` and `wait-for-terraform.yml` from `smirnoff-league/.github/workflows/`, with actions pinned to SHAs. **Terraform runs only in Actions**: plan on PR, apply on push to `main`. The plan and apply roles live in `xomware-infrastructure` (`oidc_smirnoff_terraform.tf`). The deploy role lives in this repo (`smirnoff-league/infrastructure/terraform/oidc_deploy.tf`). A personal repo needs both OIDC subject forms, `repo:domgiordano/<repo>` and `repo:domgiordano@44783934/<repo>@<repo-id>`, so the repo has to exist before the roles do.

**Domain as config.** Use smirnoff's `var.domain_name` + `var.route53_zone_name` (`smirnoff-league/infrastructure/terraform/variables.tf`), set to `dwts.xomware.com` / `xomware.com`. The API is `api.${domain_name}` (`smirnoff-league/infrastructure/terraform/locals.tf:9`). One caveat: the site bucket is named after the domain (`smirnoff-league/infrastructure/terraform/variables.tf:14`, `deploy-frontend.yml:17`). So the move replaces the bucket, the distribution and the cert. That's static, redeployable content, and DynamoDB is untouched.

**Auth: new family pool.** Add `armchair-users` in `xomware-infrastructure`, next to the shared pool, following that repo's pattern: the pool owner holds the clients and consumers read SSM (`xomware-infrastructure/terraform/cognito.tf`, `cognito_ssm.tf`). It gets:
- One Google IdP of provider type `Google`. The new pool has its own slot; the shared pool had to use OIDC for its second one (`cognito_google_idp.tf:91`).
- An `armchair-dwts-client` app client, Google only. Callbacks are `https://dwts.xomware.com/auth/callback` plus `localhost:3000` and `127.0.0.1:3000` (`cognito.tf:501-513`).
- The Amazon prefix Hosted UI domain.
- `deletion_protection = "ACTIVE"` from day one.
- SSM exports under `/armchair/shared/cognito/*`.

The app reads the pool ARN from SSM like `smirnoff-league/infrastructure/terraform/data_cognito.tf`. The frontend build reads pool, client and domain from SSM at deploy time, never from GitHub secrets (`smirnoff-league/.github/workflows/deploy-frontend.yml:74-92`). The Google consent screen shows the `amazoncognito.com` host until a custom `auth.<family-domain>` exists (`cognito_smirnoff_domain.tf:1-5`), so that waits for the domain move.

**Avatar (MVP).** Use the Google `picture` claim, which the IdP attribute mapping carries (`cognito_google_idp.tf:78`), with an initials fallback. **Unverified**: whether `picture` arrives in the ID token claims the authorizer passes to the Lambda. Check it in PR 7.

**Judges' scores.** Wikipedia S35 through the MediaWiki API, with a 3-minute confirm window and sanity checks. The design is in BRAINSTORM "Data sources" and the gotchas are in RESEARCH Q1. The poller runs on `aws_scheduler_schedule` with `schedule_expression_timezone = "America/New_York"`, so DST (11/1) and the Monday 11/2 show need no special handling. **This resource is new to the estate.** Every existing cron uses `aws_cloudwatch_event_rule`, which has no timezone support (`xomper-infrastructure/terraform/lambdas_scheduled.tf:10-15`). It needs its own scheduler IAM role.

Each tick is **one** `action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main` call for the whole page. The parser then finds the `=== Week N` heading itself, which avoids relying on section indexes that shift as the page grows (RESEARCH Q1: `section=N` indexes 9-12 today). The User-Agent names the app and the public repo URL as the contact, per [API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette), so no email goes in git.

## Data model

Five tables, all `{app}-*`, PAY_PER_REQUEST, KMS, PITR, deletion protection, no GSIs.

| Table | pk | sk | Items |
|---|---|---|---|
| `catalog` | `SEASON#dwts#35` | `META` | wiki page title, default judge order, air timezone `America/New_York` |
| | | `EP#05` | `week`, `airDate`, `start`/`end` local times, `theme`, `panel` (ordered judge ids, which sets the seat count), `dancesPerCouple` (default 1), `results` (eliminated ids, per-couple totals and bonus; read only through the gate) |
| | | `CONTESTANT#{cid}` | `members[]` (`{name, role: celebrity|pro, headshot: {file, author, license, sourceUrl} or null}`), `aliases[]` (`Connor W.`, `Conner L.`), `keyword` (derived), `keywordOverride`, `eliminatedEp` (read only through the gate) |
| | | `JUDGE#{jid}` | name, aliases, headshot. Guest judges get auto-created by the poller from the judge-order line |
| | | `POLLER` | `lastRevid`, `lastRunAt` (added in PR 10) |
| `performances` | `EP#dwts#35#05` | `PERF#{cid}#{n}` | `contestants[]` (more than one means a team dance), `rateable`, `style`, `song`, `judges: {jid: {value: Decimal, state: provisional|confirmed, firstSeenAt, rev}}`, `bonus` |
| `scores` | `EP#dwts#35#05` | `PERF#{cid}#{n}#USER#{sub}` | `value` (int 1-10) or `forfeit: true` ("Reveal without scoring"), `submittedAt`. Written with `attribute_not_exists(sk)` |
| `users` | `sub` | — | `name`, `picture`, `avatarKind` (`google` or `initials` in the MVP), `createdAt`, `lastSeenAt` |
| `groups` | `GROUP#{gid}` | `META` / `MEMBER#{sub}` | name, `createdBy`, `inviteCode` / `joinedAt` |
| | `USER#{sub}` | `GROUP#{gid}` | reverse index for "my groups". Written in the same `TransactWriteItems` as `MEMBER#` |
| | `INVITE#{code}` | `GROUP` | `gid` |

**Access patterns**

| Need | Operation |
|---|---|
| Season roster, schedule, panel, keywords | one Query on `catalog` pk `SEASON#dwts#35` (about 200 items, well under 1 MB) |
| Episode state for the caller | Query `performances` and `scores` on pk `EP#...`, then filter in memory through the gate |
| Submit a score | Query `catalog` and `performances` to check the key is rateable, then a conditional Put on `scores` |
| Caller's groups, a group's members | Query `groups` pk `USER#{sub}` or `GROUP#{gid}` |
| Join by link | GetItem `INVITE#{code}`, then a transaction writing `MEMBER#` and `USER#...GROUP#` |
| Season stats for a user | about 11 episode Queries on `scores` + `performances`. Add a `sub` GSI only once global users make this slow |

A performance is keyed `episode + contestant + ordinal`, so a user can score a couple before any source knows the running order (BRAINSTORM "Things the brief didn't say"). The poller attaches style and judges' values to the same key. Submit validates that the contestant was active in that episode and that `n <= dancesPerCouple`.

**Scoring edge cases (RESEARCH Q5 and the Q1 gotchas)**

| Case | Source | Model | MVP |
|---|---|---|---|
| 3 judges, 30 max | S35 | `panel` of 3 | rated |
| Guest judge, 4 judges, 40 max; judge order changes | S34 wk5-9 | `panel` from that week's judge-order line; unknown name → new `JUDGE#` | rated, desk shows 4 seats |
| Judge absent, 2 judges, 20 max | S34 wk1 | `panel` of 2 | rated; per-judge accuracy skips the absent judge |
| 5 judges | S31 | `panel` of 5 | parsed only (history deferred) |
| Half points | S15 | judge `value` is a Decimal; the user paddle stays a whole 1-10 | rated |
| Multi-dance week (rowspan) | S34 wk10, S35 semis/finale | `n` ordinal from rowspan continuation rows | rated |
| Finale extra "Judge" column | S34 wk11 | parser tolerates extra columns by matching header names, never position | rated |
| Two-night week | S35 wk1 | two `EP#` items with the same `week`. The caption format that tells the nights apart is **unknown** | S35 wk1 seeded for history only |
| Team dance (one score, several couples, `<br />` in the row header) | S34 wk8 | `contestants[]` of more than 1, `rateable: false` | shown, not rated |
| Marathon bonus (bare integers) | S34 wk7 | `bonus` on the performance | excluded from accuracy |
| Relay / dance-off table (winners and losers, no per-judge scores) | S34 wk9 | ignored by the score parser; bonus and immunity **unknown** shape | not modelled |
| No-elimination week | S34 wk1, 5 | `results.eliminated = []` | shown after the episode gate |
| Score from dress-rehearsal footage | S34 wk7 | normal cell plus a note; the parser strips the note | rated |
| Pre-show alphabetical table, reordered live | RESEARCH Q1 | rows keyed by alias, never by position; empty score cells mean no value | — |
| Row wrappers `{{nowrap}}`, `{{efn}}`, `{{dagger}}` | RESEARCH Q1 | stripped before alias lookup | — |
| Vandalism (S35 wk3: a bogus 30 and swapped judges, reverted in 1m46s) | RESEARCH Q1 | `provisional` until the same value survives 180 s; a changed value resets the clock | never confirmed |
| Page locked (premiere) or unprotected (from 11/19 02:22 UTC) | RESEARCH Q1 | judges' seats stay `pending` (F1 delayed fill) | accepted for the MVP; F2 later |

**Sanity checks before a value can go provisional:** each judge value is in 1-10 (0.5 steps allowed), the values sum to the total, the judge count equals the parsed panel for that week, and the couple resolves through an alias. A row that fails is logged and skipped.

**Accuracy (`common/accuracy.py`).** It runs per performance, only where the caller answered with a value, the performance is `rateable`, and every panel judge is `confirmed`.
- vs the mean: `|paddle - mean(panel values)|`. This puts 2-, 3- and 4-judge nights on the same 1-10 scale.
- vs each judge: `|paddle - value_j|` for each judge on that night's panel. A judge absent that night contributes nothing, and a guest judge counts as their own judge.
- Aggregates are mean absolute error per episode and per season, overall and per judge. Skips, bonus points and team dances are excluded.

**SMS keyword derivation (`common/keywords.py`).** The keyword is the celebrity's first name. If two celebrities in the same season share a first name (case-insensitive), each gets first name + space + last-name initial, e.g. `John S`. Suffixes like `Jr.` don't count as the last name: `Harry Shum Jr.` → `S`. An admin `keywordOverride` always wins. The rule doesn't catch spelling variants: ABC split `Conner`/`Connor` in the S35 premiere even though the names differ (RESEARCH Q4), so that case needs the override. Casing is **unknown**: past seasons used caps (`JOEY`), and whether caps matter to 21523 is **unknown**. On 10/6, check the derived set against the FAQ list.

## Gating rule (server-side)

`common/gate.py` is the only code that decides visibility. Every read handler builds its response through it. The client-side gate is UX, not security (`smirnoff-league/.claude/CLAUDE.md` Constraints).

1. **Per performance.** `answered(sub, perf)` is true iff a `scores` row exists for the caller, whether it holds a value or a skip. Until then the performance returns only `{key, contestants, n, style, song, locked: true}`: no judge values, no other users' values, no counts, no aggregates. That holds with or without a group filter.
2. **Per episode.** Eliminations, totals, bonus, cumulative standings and `eliminatedEp` on contestants are returned only once the caller has answered every rateable performance in that episode. The rateable set is active contestants × `dancesPerCouple`, so it's known before Wikipedia fills in.
3. **Stats.** Every stat, the caller's and other users', global or group, is computed only over performances the caller has answered.
4. **Order.** Unanswered performances sort alphabetically, matching the pre-show Wikipedia table. They never sort in running order.
5. **No bypass.** Admin endpoints return no score data. No static or public JSON carries scores. A group filter narrows the visible set and never widens it.
6. **Final.** Submit uses a conditional put. A retry with the identical value returns 200 with the stored row, so a double tap or network retry is safe. A different value returns 409. There is no update or delete endpoint.

## Affected Files / Components

| File / Component | Change | Why |
|---|---|---|
| `xomware-infrastructure/terraform/oidc_armchair_terraform.tf` | new, a copy of `oidc_smirnoff_terraform.tf` | plan and apply roles for the new repo (base branch `master`) |
| `xomware-infrastructure/terraform/cognito_armchair.tf` | new pool, Google IdP, `armchair-dwts-client`, prefix domain | dedicated family pool |
| `xomware-infrastructure/terraform/cognito_armchair_ssm.tf` | `/armchair/shared/cognito/{user-pool-arn,user-pool-id,hosted-ui-domain,clients/dwts-id}` | consumers read SSM |
| `armchair/infrastructure/terraform/*.tf` | new stack: `main`, `variables`, `locals`, `web_hosting`, `kms`, `dynamodb`, `lambda`, `lambda_layers`, `lambdas_cron`, `api_gateway`, `waf`, `route53`, `acm`, `ssm`, `oidc_deploy`, `data_cognito` | smirnoff layout |
| `armchair/backend/lambdas/common/{api,logger,dynamo,admins}.py` | copied from smirnoff | handler plumbing and admin check |
| `armchair/backend/lambdas/common/{wiki_parse,wiki_client,confirm,gate,accuracy,keywords}.py` | new | domain logic |
| `armchair/backend/lambdas/{cron_poll_wiki,users_me,scores_submit,episodes_state,seasons_get,groups_create,groups_join,groups_mine,stats_episode,admin_keyword}/handler.py` | new | endpoints and poller |
| `armchair/backend/scripts/{seed_season,build_wiki_fixtures}.py` | new | seed from Wikipedia and Commons; rebuild fixtures |
| `armchair/fixtures/wiki/*.wikitext`, `fixtures/wiki-golden.json`, `fixtures/README.md` | new | real revisions with hand-checked expected output (pattern: `smirnoff-league/fixtures/README.md`) |
| `armchair/frontend/lib/auth/amplify.ts` | copied from smirnoff | Google sign-in |
| `armchair/frontend/app/{page,auth/callback,episode,groups,join,stats,credits}/` | new | screens (query params, not dynamic routes, under static export) |
| `armchair/frontend/components/{PaddlePicker,PerformanceCard,Desk,VoteButton}.tsx` | new | UI |
| `armchair/.github/workflows/*` | copied from smirnoff | CI/CD |
| `armchair/.claude/CLAUDE.md` | new | project config, `pm_tool: none`, public-repo data constraints |

## Implementation Steps

### Manual prerequisites (Dom)
- [ ] M1 — Create the public repo `domgiordano/armchair` (name per Open Question 1) and note its numeric repo id for the OIDC subject. **By Thu 10/1.**
- [ ] M2 — Create a Google Cloud OAuth client (Web) for the app family. Set the redirect URI to `https://armchair-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`, or whatever prefix PR 5 uses. Write the credentials to SSM `/armchair/shared/google-oauth/client-id` (String) and `/client-secret` (SecureString), the same procedure as `cognito_google_idp.tf:10-28`. **By Mon 10/5.** It blocks PR 5.
- [ ] M3 — After the first apply, set repo secrets `AWS_TERRAFORM_PLAN_ROLE_ARN`, `AWS_TERRAFORM_APPLY_ROLE_ARN`, `AWS_ROLE_ARN` (deploy role output) and `ADMIN_EMAILS`, per `smirnoff-league/.github/workflows/terraform.yml:28,48`.

### PR decomposition

Sizes count hand-written logic only; HCL copied from smirnoff with renames counts as mechanical. **CP-10/6** = on the dry-run critical path. **CP-10/13** = on the MVP critical path.

| # | Repo | PR (one idea) | Logic | Needs | Path |
|---|---|---|---|---|---|
| 1 | xomware-infrastructure | OIDC plan/apply roles for `domgiordano/armchair` | ~0 (copy of `oidc_smirnoff_terraform.tf`, ~140 HCL) | M1 | **CP-10/6** |
| 2 | armchair | Scaffold: workflows, Terraform base (state, variables, web hosting, KMS, layer, deploy role), common layer (`api`, `logger`), blank mobile shell page, `CLAUDE.md` | ~50 | 1, M3 | **CP-10/6** |
| 3 | armchair | Wikipedia week parser + golden fixtures (pure functions: `parse_week`, alias resolution, sanity check) | ~200 | repo exists (can merge before 2; CI is `pytest` only) | **CP-10/6** |
| 4 | armchair | Poller dry run: `cron_poll_wiki` + `aws_scheduler_schedule` (`cron(* 20-22 ? * MON,TUE *)`, `America/New_York`) + scheduler role. Fetches, parses, logs structured JSON per tick. No writes | ~100 | 2, 3 | **CP-10/6** (merged and applied by Mon 10/5) |
| 5 | xomware-infrastructure | `armchair-users` pool + Google IdP + `armchair-dwts-client` + prefix domain + SSM exports | ~0 (~150 HCL) | M2 | **CP-10/13** (start in parallel with 1-4) |
| 6 | armchair | Catalog: `catalog` table, `common/keywords.py` + tests, `seed_season.py` (S35 roster, aliases, judges, episodes 1-11 with week, date, theme and panel; Commons headshot metadata; uploads headshots to `s3://<site-bucket>/headshots/`) | ~180 | 2, 3 | **CP-10/13** |
| 7 | armchair | Sign in and see yourself: `data_cognito.tf`, API module + ACM + `api.` record + WAF association + `/armchair/api-url` SSM, `users` table, `users_me` (upserts name and picture from claims), Amplify config, `/auth/callback`, avatar with initials fallback, deploy-frontend SSM reads | ~150 | 2, 5 | **CP-10/13** |
| 8 | armchair | Score and gate: `performances` + `scores` tables, `common/gate.py` (per-performance **and** per-episode rules), `scores_submit`, `episodes_state` (global view only), gate test suite | ~200 | 6, 7 | **CP-10/13** |
| 9 | armchair | Episode screen: `seasons_get` (schedule + credits), couple cards alphabetical, paddle picker 1-10 + "Reveal without scoring" + final-confirm step, locked vs revealed card as a plain number list, polling hook (10s visible and live, 60s otherwise, paused when hidden), `/credits` Commons attribution page | ~280 | 8 | **CP-10/13** |
| 9b | armchair | Catch-up: per-episode "Reveal all" (bulk forfeit, server-side through `gate.py`) + "Finish week N-1 / Go to week N" interstitial | ~60 | 9 | **CP-10/13** |
| 10 | armchair | Poller publishes: writes provisional → confirmed (`common/confirm.py`, 180 s), style and song, `panel` from the judge-order line, `results` from the Result column. Air-date check reads `catalog`. `lastRevid` short-circuit | ~150 | 4, 8 | **CP-10/13** |
| 11 | armchair | Desk visual: SVG seats per panelist + you + group members (a global-average paddle and count when no group is selected), CSS paddle raise, `pending`/`confirmed` judge seats | ~200 | 9 | 10/13 target. PR 9's number list is the fallback if it slips |
| 12 | armchair | Groups: `groups` table, `groups_create` / `groups_join` / `groups_mine`, `/join/?code=`, `group` filter on `episodes_state` | ~180 | 8 | 10/13 target, first to slip (global view works without it) |
| 13 | armchair | Vote button: `admin_keyword` override (SSM admin list, `smirnoff-league/backend/lambdas/common/admins.py`), ET clock window 8-10 pm on air dates, `sms:21523` + keyword, local 0-10 per-couple counter, `dwtsvote.abc.com` link, closed state for delayed viewers | ~150 | 6, 7 | **CP-10/13** |
| 14 | armchair | Accuracy + stats: `common/accuracy.py` (mean and per-judge MAE, 2/3/4 panels, half points, exclusions), `stats_episode` through the gate, group filter, stats screen | ~180 | 8, 10 (12 for the group filter) | 10/13 target, second to slip |

**Why this order.** 3 and 4 are the only pieces Dom can't redo by hand, and 10/6 is the one free live night (BRAINSTORM). The Cognito pool (5) is off the 10/6 path, so the scaffold (2) ships without an API; the API arrives in 7. The per-episode gate lands in 8, before the poller writes eliminations in 10. Otherwise 10 would publish results ungated. PR 4 lands the poller unwired to any table, and PR 10 flips it to publish. Reverting 10 puts it back to log-only.

**10/6 dry-run checklist (not a PR)**
- [ ] CloudWatch shows one tick per minute, 8:00-10:59 pm ET, one API call per tick, UA set.
- [ ] A stopwatch against the broadcast records each on-air reveal time next to the first log line containing that couple's score. This answers RESEARCH's open question on delay.
- [ ] Record the S35 SMS keywords from `dwtsvote.abc.com/faq` during 8-10 pm ET and compare them with `keywords.py` output. Check whether caps are used.
- [ ] Save 2-3 mid-show revision ids (partly filled, reordered) as new fixtures for PR 10.

### Test plan
- **Parser golden (PR 3).** Real wikitext by revision id in `fixtures/wiki/`, and expected output hand-written in `build_wiki_fixtures.py`, never computed by the parser (the `smirnoff-league/fixtures/README.md` rule). Cases:
  - S35 wk2 and wk3 final
  - the S35 wk3 vandal revision at 2026-09-30 01:23 UTC and its revert
  - the S35 wk4 pre-show alphabetical table with empty cells
  - S35 wk1 (two nights, `Conner L.`/`Connor W.`)
  - S34 wk1 (2 judges), one of wk5-9 (4 judges), wk7 (marathon bonus, rehearsal note), wk8 (team dance), wk10 (rowspan), wk11 (Judge column)

  The README records each revision id and CC BY-SA 4.0 attribution.
- **Confirm state machine (PR 10).** Replay the real S35 wk3 revision sequence. The vandal 30 is never confirmed, and Connor's swapped scores are never confirmed. Each real value confirms 180 s after first sight. A sanity failure (wrong sum, wrong judge count, unknown couple) never goes provisional.
- **Gate (PR 8, extended by 12 and 14; moto, `smirnoff-league/backend/tests/conftest.py` pattern).**
  - User A, no answers: every performance in `episodes_state` has exactly the locked key set.
  - After A submits perf X, only X reveals, with judges, B's value and global aggregates.
  - `results` and `eliminatedEp` are absent until all rateable perfs are answered, and a skip counts as answered.
  - The group filter never reveals a perf A hasn't answered.
  - `stats_episode` excludes unanswered perfs for A's own and others' numbers.
  - A second submit with a different value returns 409 and the same value returns 200.
  - Submits for an eliminated contestant, for `n > dancesPerCouple`, for a value outside 1-10, and a non-int or bool value are all rejected.
  - Admin callers get the same gated responses.
- **Keywords (PR 6).** Unique first names; a shared first name gives `John S`/`John D`; case-insensitive clash; a `Jr.` suffix; override wins; the S35 roster gives the expected 12 active keywords.
- **Accuracy (PR 14).** 2-, 3- and 4-judge panels; half-point judges; absent judge per-judge; provisional excluded; skip, bonus and team dance excluded.
- **Frontend (vitest).** The voting-window function in ET across Tue 10/13, Mon 11/2 (after DST) and a Pacific-timezone device; the polling interval selector; paddle-picker final-confirm flow.
- **Manual (per `verification.md`).** Each UI PR states "verified in app" after walking it on an iPhone against the deployed site. PR 7 confirms the `picture` claim arrives, and PR 9 confirms a second account can't see A's score before answering.

## Deferred (after 10/13)

| Item | When | Note |
|---|---|---|
| **F2 reporter role** | **before Tue 11/17** | Page protection lapses 11/19 02:22 UTC, before the 11/24 finale (RESEARCH Q1). Reported values are shown as `reported`, never count toward accuracy, and get overwritten by confirmed Wikipedia values |
| **Domain move** to the family domain | once Dom picks it | Change `domain_name`/`route53_zone_name` (new zone), which replaces the bucket, distribution and cert. Add callback and logout URLs to the client, a custom `auth.<domain>` Cognito domain for Google consent branding, CORS origins and the UA string. Redirect `dwts.xomware.com`, whose mechanism is **unknown** |
| Uploaded photo avatar | later | presigned S3 POST, as in the smirnoff videos flow |
| Drawn character avatar | later | desk art dependency |
| Progression charts, me vs judges vs others over time, style filters | later | |
| S1-S34 history | later | parser reuse, about 6 format special cases (RESEARCH Q2) |
| EventStreams trigger, F3 early confirm, WebSockets, Rive | next season | BRAINSTORM Option 3 |
| ABC widget JSON for the real voting window | later | undocumented, Disney ToS; clock fallback until then |
| Group management (leave, remove, rename), "closest judge" stat, notifications, second show | later | |
| Team dances and bonus rounds as rateable | later | |

## Out of Scope
- Typing judges' scores by hand as an admin. Dom won't (BRAINSTORM).
- Automated voting, or any scraping of `dwtsvote.abc.com` (bot protection, ToS; RESEARCH Q4).
- ABC widget couple images, which are copyrighted with no license (RESEARCH Q3).
- Friends' names, emails or scores in git. Fixtures hold only public show data.
- Running Terraform locally.

## Risks / Tradeoffs
- **Tight 10/6 path, with M1 and PR 1 in a second repo before anything applies.** Mitigation: PR 3 is pure Python and can merge before infra exists. If PR 4 misses 10/6, run the parser against the revision history for 10/6 afterward via the revisions API. That loses only the live latency measurement.
- **The TV shows the paddles seconds after each dance**, so the gate can't stop someone who watched live, and accuracy is honor-system (BRAINSTORM). Accepted.
- **The Wikipedia path fails on locked or vandalised nights** (RESEARCH Q1). F1 delayed fill in the MVP, F2 before the finale.
- **The new pool lives in `xomware-infrastructure`, but the family is not Xomware-branded.** That repo is where pools, clients and OIDC roles already live. Moving a pool later isn't possible without recreating users, so this is Open Question 2.
- **`aws_scheduler_schedule` is unproven in this estate.** It's small and covered by the 10/6 dry run.
- **Global visibility exposes every user's Google name and photo to all signed-in users.** This is Dom's decision. There's no display-name edit in the MVP.
- **Episode N's roster reveals N-1's elimination to a delayed viewer who opens N first.** Open Question 4.
- **Some Commons headshots are 10+ years old, and Guillermo's needs an eyeball check** (RESEARCH Q3). They're displayed with a CSS circle crop, so no derivative file is published. That's a technical choice, not a legal read.
- **Keywords are unverified until 10/6** (RESEARCH Q4), and Android `sms:` body syntax is **unverified** (BRAINSTORM Q2).

## Open Questions
- [x] 1. `armchair` is the permanent prefix. No existing "Armchair Judge" app found; `domgiordano/armchair` is free on GitHub. Closest: `utzn/armchair-judge` (boxing scorer) and a 2022-23 combat-sports podcast.
- [x] 2. New pool goes in `xomware-infrastructure`.
- [x] 3. Users score couples in any order, any time. An unscored performance simply stays locked and scorable. "Skip" is renamed **Reveal without scoring**: an explicit, final forfeit that unlocks the reveal and is excluded from accuracy.
- [x] 4. Opening episode N with N-1 unfinished shows an interstitial: "Finish week N-1" or "Go to week N". Going ahead leaves N-1's performances unanswered and still scorable; the elimination leak is accepted.
- [x] 5. Global desk: judges + you + global-average paddle; individual seats only under a group filter.
- [x] 6. No reporter plan for the finale; Wikipedia is expected to work, delayed fill is acceptable.
- [x] 7. Weeks 1-3 are scorable after the fact. Add a per-episode **Reveal all** (bulk forfeit of every unanswered performance) for catch-up users.

## Skills / Agents to Use
- **executor** (`/execute`) or `/goals` + `/work-issue`: one issue and PR per row of the decomposition, in the order above.
- **terraform** / **infra-standards** skills: PRs 1, 2, 4, 5, 7, the `aws_scheduler_schedule` resource and the scheduler IAM role.
- **lambda-handler** / **database** skills: PRs 8, 10, 12, 13, 14 (house handler shape, conditional puts, transactions).
- **code-reviewer** (`/review`): every PR, and PR 8 above all. Ask it to hunt for any read path that bypasses `gate.py`.
- **researcher** (`/research`): only if the 10/6 dry run shows Wikipedia latency far worse than 5-12 min.
