# Activity tracking and the admin console

First-party only. No third-party script, pixel or cookie. The three sites send
batched events to our own API, which stores them in `armchair-events`
(`infrastructure/terraform/dynamodb_events.tf`). Code: `backend/lambdas/common/events_dynamo.py`.

## What an event holds

| Field | Value |
|---|---|
| `uid` | the Cognito sub when signed in, else `anon#{did}` |
| `sub` | the Cognito sub, signed in only |
| `did` | a random id the browser keeps in local storage; never derived from the device |
| `app` | `dwts`, `traitors` or `hub` |
| `kind` | `view` (a page or drill-in), `action` (an API write, a share, an app switch), `error` |
| `name` | `page` for views, else the action (`scores_submit`, `share`, `app_switch`) |
| `route` | the path, with only `season`, `ep`, `id`, `tab`, `show`, `group` kept from the query string |
| `session` | random per tab, renewed after 30 idle minutes |
| `device` | `phone`, `tablet` or `desktop`, from the viewport width |
| `props` | at most 8 short values, e.g. an error's HTTP status |

No name, email, IP address or user agent is stored. A route never keeps an
invite code: that code is the only key to its group. The anonymous endpoint
hashes the source IP for its per-minute rate limit and keeps the hash for five
minutes.

## Do-Not-Track

A signed-out browser with `navigator.doNotTrack == "1"` or Global Privacy
Control sends nothing, and `/events/anon` drops a request carrying `DNT: 1` or
`Sec-GPC: 1` in case a client doesn't check. A signed-in visitor is tracked
under their account either way: it is the same account data the app already
holds, and the privacy page says so.

## Endpoints

- `POST /events/track` (Cognito): signed in, tracked under the sub.
- `POST /events/anon` (no auth): signed out, tracked under `anon#{did}`.

Both take at most 25 events a batch and 120 a minute per key (sub, or IP hash),
then answer 429. A client clock more than 15 minutes off is replaced by the
server's.

## Retention

Events expire 400 days after they happen (DynamoDB TTL on `expiresAt`). Daily
rollups and the admin audit log are kept. Deleting an account
(`/users/delete`, or the admin console's delete) removes the account's events,
its entries in every rollup, and the before/after detail of audit entries
about it; the audit entries themselves stay.

## Rollups

`cron_rollup_events` runs daily at 00:30 UTC and rewrites the last two UTC
days as one `ROLLUP / DAY#{date}` item each: per-app events, views, sessions
and the sets of devices and subs, and per-user events, sessions, last seen,
per-app counts and per-action counts. Rewriting is idempotent; invoke with
`{"days": N}` to rebuild further back. Today is always computed live from the
day's partition.

Distinct counts over a range (WAU, MAU, users by week, retention) are unions of
the days' sets. A day item holds every active sub and device, so it nears
DynamoDB's 400 KB item limit at roughly 2,500 daily users; past that the
rollup needs splitting per app.

## For other features

`events_dynamo.active_users(app, days=30, action=None)` returns the subs
signed in on `app` in the last `days` days. With `action` (an endpoint name,
e.g. `traitors_pick`) it returns those who made that call, on any app. It
knows only what happened since tracking began; the scores table holds older
answers.
