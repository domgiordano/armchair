# Plan: Armchair Judge v2 — a real product

**Status**: Ready
**Created**: 2026-09-30

## Why
Dom's review of v1: the hub gives little information and has a DWTS-only button in the header; the DWTS signed-in home is a single button; no navigation, profile, friends, notifications, leaderboards or charts; only the current season exists. Intros look fake (being rebuilt in 3D separately) and should play on every load.

## Decisions
- **Social is family-level, not show-level.** Users, friends, groups and notifications belong to Armchair Judge, so one friend list and one group work across every show app. Tables stay `armchair-*`; nothing in them is keyed by show. A group can be used as a filter in any show.
- **Navigation.** Desktop: top tabs. Mobile: header with a hamburger opening a sheet. Tabs: Overview, Episodes, Leaderboard, Stats, Friends & Groups, Profile. Notifications bell in the header with an unread count.
- **Hub header.** Replace "Open DWTS" with an **Apps** dropdown listing every show app (DWTS live; Traitors, Survivor "coming soon", disabled).
- **Seasons.** Season picker everywhere, defaulting to the current season. Backfill every past DWTS season (S1–S34) from Wikipedia: cast, pros, judges, episodes, dance styles, songs, per-judge scores, results. Past-season performances are scorable after the fact (blind rule unchanged); judge data is already confirmed.
- **Leaderboards** rank by mean absolute error vs the judges' average, minimum 5 scored dances, per season and all-time; global, friends, and per group. Every number goes through `gate.py`: a user's accuracy only counts dances they answered, and leaderboards only show other users' aggregates, never per-dance values the viewer hasn't answered.
- **Profile.** Display name (editable), photo (Google, uploaded via presigned S3 POST to a private-read prefix served through CloudFront, or initials), season stats, accuracy by judge and by dance style, best/worst calls, friends count, groups.

## Workstreams (parallel; each is a series of one-idea PRs)
| # | Stream | PRs |
|---|---|---|
| W1 | Hub v2 | Apps dropdown; richer landing (what's live, features with app screenshots, FAQ, "for every show" section); intro on every load |
| W2 | DWTS shell + Overview | nav shell (tabs / hamburger / bell / season picker) → `overview_get` endpoint (season progress, your stats, next episode countdown, latest reveals, top of leaderboard, trending couples) → Overview page with charts |
| W3 | Social | friends (request/accept/decline/remove, add by invite link or search by name) → notifications (friend requests, group invites, join requests; bell + list; mark read) → group invites to friends + member management → Friends & Groups page |
| W4 | Profile | `users_update` (display name, photo choice) + presigned upload → Profile page with stats and charts |
| W5 | Leaderboards + Stats v2 | `leaderboard_get` (season/all-time × global/friends/group) → Leaderboard page → Stats page charts (accuracy trend, by judge, by dance style, score distribution) |
| W6 | Past seasons | generalize the season seed + parser for S1–S34 (special cases from RESEARCH Q2) → backfill workflow → season picker data |

## Order
W2's nav shell merges first (small); every other stream mounts its page into it. W3/W4/W5 backend PRs can merge any time. W6 is independent.
