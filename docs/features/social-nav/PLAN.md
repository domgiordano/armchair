# Plan: Social front and center

**Status**: Ready
**Created**: 2026-10-06

## Why
Social is the point of the app, and today it's buried. Friends and groups live only in `OwnSocialSheet`, opened from the counts on `/profile/` (`?sheet=groups`). The six tabs in `components/app-shell.tsx` are all show content. The account menu has "Your profile" and "Sign out" and nothing else. Group member rows show no relation, so you can't friend someone from a group. There's no way to delete an account. Group invites share as `{ title: "Join X on Armchair Judge", url }`, and iMessage/WhatsApp mostly drop `title`, so friends see a bare link whose preview says "Join a group".

## What exists (reuse, don't rebuild)
- `OwnSocialSheet` (`components/social/social-sheet.tsx`, 543 lines): the Friends / Groups / Requests tabs, search, create group, and requests already work. It's just mounted in the wrong place.
- `FriendButton` (`components/social/friend-button.tsx`): the full add / accept / remove / block state machine.
- `CopyLink` (`components/social/parts.tsx:148`): copy plus `navigator.share`.
- Backend: `friends_*`, `groups_*`, `people_search`, `notifications_*`, `users_*`. There's no delete endpoint.

## Decisions (confirmed 2026-10-06)
1. **New `/social/` page with a "Friends & Groups" tab.** It's the existing sheet content promoted to a full page, with the same three views plus a `?view=` param. The `?sheet=` links on Profile and Join redirect there. The original v2 plan already called for a "Friends & Groups" tab that never shipped.
2. **Nav.** Add the tab to `TABS` (desktop row and hamburger). Account menu becomes: name → Your profile, Friends & Groups (with a requests badge), Find people, Settings, Sign out. "Find people" opens `/social/?view=friends` with search focused.
3. **Group member rows get `FriendButton`.** `groups_manage`/group detail returns each member's `relation` (one batch read from the social table), and the row renders the compact button for anyone who isn't you.
4. **Share text.** `CopyLink` passes `text` as well as `title` ("Join *Couch Crew* on Armchair Judge — rate DWTS with us"). This works on every share target today.
5. **Link previews ("Join Couch Crew" in the iMessage bubble).** Static export means `/join/` has one OG card for every group. A real per-group preview needs something server-side to render OG tags by code. Proposed: an `invite_preview` Lambda behind a CloudFront behavior on `/i/*` that looks up the code and returns a tiny HTML page with `og:title` = "Join {group}" plus an instant redirect to `/join/?code=`. Share links become `/i/{code}`, and old `/join/?code=` links keep working. In this batch.
6. **Delete account.** It lives in a new Settings section on your own profile, behind a typed confirm. `users_delete` removes: the users row, social edges both ways, notifications, avatar objects in S3, memberships, owned groups (ownership passes to the longest-standing member; deleted if you're alone), and the Cognito user (`AdminDeleteUser`; the pool lives in xomware-infrastructure, but the grant can be on this stack's Lambda role via the SSM ARN). Scores are deleted too (DWTS scores, Traitors picks, board ERR rows), and crowd aggregates are recomputed.

## Gaps / risks
- Traitors (`traitors/components/app-shell.tsx`) has its own shell and no social pages. Social is family-level, so its account menu should link to DWTS's `/social/` until there's a hub-level home for it. That's out of scope here beyond the link.
- Scores deletion touches `board_dynamo` ERR items. The leaderboard has to drop the user cleanly, not just leave orphans.
- Apple App Store rules require in-app deletion if this ever ships native. Doing it now avoids that later.

## Implementation (one idea per PR)
```
1. /social/ page: lift sheet content into a page; ?sheet= redirects    ~150 lines  no deps
2. Nav: Friends & Groups tab + account menu items + requests badge     ~80 lines   needs 1
3. Share text: CopyLink sends text, group/friend copy updated           ~15 lines   no deps
4. Backend: relation on group members                                   ~40 lines   no deps
5. Group member rows: FriendButton (compact)                            ~50 lines   needs 4
6. Backend: users_delete Lambda + TF (Cognito grant, table grants)      ~200 lines  no deps
7. Settings section on profile + delete flow                            ~100 lines  needs 6
8. Invite previews: /i/{code} Lambda + CloudFront behavior + links      ~150 lines  needs 3
9. Traitors account menu links to DWTS social                           ~15 lines   needs 1
```
1, 3, 4 and 6 can go in parallel.
