"""
GET /traitors/ranks?season=tus-5 | season=all&show=tus [&scope=global|friends|group&group=<gid>]
- users ranked by Traitors points.

Reads only the per-user sums common/traitors_board.py keeps, never a pick. Ranked by
points, then correct banishments, then events scored; a full tie shares a rank.
`scope=friends` is the caller and their accepted friends; `scope=group` is 403 unless
the caller is a member. The caller's own row is always in `me`. Points from an episode
the caller holds a sealed call in (common/seals.py) come off everyone's row, so no one
moves on a night they haven't turned over.
"""

from __future__ import annotations

from lambdas.common import board_dynamo, seals, traitors_board
from lambdas.common.api import (
    ForbiddenError,
    ValidationError,
    api_handler,
    caller_sub,
    ok,
    query,
    require,
)
from lambdas.common.episodes_dynamo import season_rows
from lambdas.common.groups_dynamo import members
from lambdas.common.social_dynamo import peers, status
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.users_dynamo import cards

LIMIT = 100


@api_handler("traitors_ranks")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    if params.get("season") == board_dynamo.ALL:
        (show,) = require(params, "show")
        if show not in EDITIONS:
            raise ValidationError("Not a Traitors edition", field="show")
        season, label = board_dynamo.ALL, f"{show}-all"
    else:
        show, season = traitors_ref(params)
        season_parts(season_rows(show, season), show, season)
        label = f"{show}-{season}"

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

    stored = seals.stored(sub)
    numbers = [season] if season != board_dynamo.ALL else _sealed_seasons(stored, show)
    for n in numbers:
        held = seals.episodes(seals.in_season(stored, show, n))
        if held:
            rows = traitors_board.less(rows, traitors_board.withheld(show, n, held))

    board = {
        s: traitors_board.standing(r) for s, r in rows.items() if r.get("events") or r.get("pts")
    }
    board.setdefault(sub, traitors_board.standing(None))
    places = traitors_board.ranks(board)
    order = sorted(board, key=lambda s: places[s])[:LIMIT]
    people = cards(set(order) | {sub})
    return ok(
        {
            "season": label,
            "scope": scope,
            "group": gid,
            "ranked": [{"rank": places[s], **people[s], **board[s]} for s in order],
            "me": {"rank": places[sub], **people[sub], **board[sub]},
        },
        meta={"ranked": len(board)},
    )


def _sealed_seasons(stored: set[str], show: str) -> list[int]:
    return sorted(
        {int(i.split("|")[0].rsplit("-", 1)[1]) for i in stored if i.startswith(f"{show}-")}
    )
