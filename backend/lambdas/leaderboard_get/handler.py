"""
GET /leaderboard/get?season=dwts-35|all[&show=dwts]&scope=global|friends|group[&group=<gid>]
- users ranked by mean absolute error against the judges' panel mean.

Reads only the per-user sums common/board_dynamo.py keeps, never a score row,
and shapes each through gate.standing, so no per-dance value leaves. A user
ranks after MIN_DANCES scored dances; below that they are listed unranked with
a count. Ties go to more dances, then share a rank. `season=all` is all-time
across every season of `show`, dwts by default. `scope=friends` is the caller
and their accepted friends; `scope=group` is 403 unless the caller is a member.
The caller's own standing is always in `me`. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common import board_dynamo
from lambdas.common.api import (
    ForbiddenError,
    NotFoundError,
    ValidationError,
    api_handler,
    caller_sub,
    ok,
    query,
    require,
)
from lambdas.common.episodes_dynamo import season_ref, season_rows, show_ref
from lambdas.common.gate import places, standing
from lambdas.common.groups_dynamo import members
from lambdas.common.social_dynamo import peers, status
from lambdas.common.users_dynamo import cards

MIN_DANCES = 5
LIMIT = 100


@api_handler("leaderboard_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    if params.get("season") == board_dynamo.ALL:
        show, season, label = show_ref(params), board_dynamo.ALL, board_dynamo.ALL
    else:
        show, season = season_ref(params)
        label = f"{show}-{season}"
        if not any(r["sk"] == "META" for r in season_rows(show, season)):
            raise NotFoundError("No such season", season=label)

    scope = params.get("scope") or "global"
    gid = None
    if scope == "global":
        rows = board_dynamo.rows(show, season)
    elif scope == "group":
        (gid,) = require(params, "group")
        in_group = members(gid)
        # A group that doesn't exist answers the same, so a guess learns nothing.
        if sub not in in_group:
            raise ForbiddenError("Not a member of that group")
        rows = board_dynamo.rows(show, season, in_group)
    elif scope == "friends":
        friends = {s for s, item in peers(sub).items() if status(item) == "friend"}
        rows = board_dynamo.rows(show, season, friends | {sub})
    else:
        raise ValidationError("scope must be global, friends or group", field="scope")

    board = {s: standing(r) for s, r in rows.items() if r.get("n")}
    board.setdefault(sub, standing(None))

    ranks = places(board, MIN_DANCES)
    ranked = sorted(ranks, key=lambda s: (ranks[s], -board[s]["count"]))
    unranked = sorted(
        (s for s in board if s not in ranks),
        key=lambda s: -board[s]["count"],
    )

    shown = ranked[:LIMIT] + unranked[:LIMIT]
    people = cards(set(shown) | {sub})

    def person(s: str) -> dict:
        return people[s]

    return ok(
        {
            "season": label,
            "scope": scope,
            "group": gid,
            "minDances": MIN_DANCES,
            "ranked": [{"rank": ranks[s], **person(s), **board[s]} for s in ranked[:LIMIT]],
            "unranked": [{**person(s), "count": board[s]["count"]} for s in unranked[:LIMIT]],
            "me": {"rank": ranks.get(sub), **person(sub), **board[sub]},
        },
        meta={"ranked": len(ranked), "unranked": len(unranked)},
    )
