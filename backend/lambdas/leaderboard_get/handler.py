"""
GET /leaderboard/get?season=dwts-35|all[&show=dwts]&scope=global|friends|group[&group=<gid>]
- users ranked by mean absolute error against the judges' panel mean.

Reads the per-user sums common/board_dynamo.py keeps, less every dance the
caller may not see (board_dynamo.seen_rows): unanswered in an episode still
taking answers, or the current season's dances they locked in without
revealing (common/seals.py, and any `sealed=<ep>:<key>,...` names). So no
one's number moves on a dance the caller
hasn't seen. Each is shaped through gate.standing, so no per-dance value leaves. A user
ranks after MIN_DANCES scored dances; below that they are listed unranked with
a count. Ties go to more dances, then share a rank. `season=all` is all-time
across every season of `show`, dwts by default. `scope=friends` is the caller
and their accepted friends; `scope=group` is 403 unless the caller is a member.
The caller's own standing is always in `me`. Identity is the Cognito sub.

A group board on the current season also carries `week`: the episode taking
answers now, or else the latest aired, with how many of its rateable dances
each member has answered. Counts only, never a value, so no gate applies.
"""

from __future__ import annotations

from lambdas.common import board_dynamo, window
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
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_ref, season_rows, show_ref
from lambdas.common.gate import answered, is_open, places, rateable, standing
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
        catalog = season_rows(show, season)
        if not any(r["sk"] == "META" for r in catalog):
            raise NotFoundError("No such season", season=label)

    scope = params.get("scope") or "global"
    gid = None
    week = None
    if scope == "global":
        rows = board_dynamo.seen_rows(sub, show, season, params)
    elif scope == "group":
        (gid,) = require(params, "group")
        in_group = members(gid)
        # A group that doesn't exist answers the same, so a guess learns nothing.
        if sub not in in_group:
            raise ForbiddenError("Not a member of that group")
        rows = board_dynamo.seen_rows(sub, show, season, params, in_group)
        if season != board_dynamo.ALL:
            week = _week(show, season, catalog, in_group)
    elif scope == "friends":
        friends = {s for s, item in peers(sub).items() if status(item) == "friend"}
        rows = board_dynamo.seen_rows(sub, show, season, params, friends | {sub})
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
            **({"week": week} if week else {}),
        },
        meta={"ranked": len(ranked), "unranked": len(unranked)},
    )


def _week(show: str, season: int, catalog: list[dict], members: set[str]) -> dict | None:
    meta = next(r for r in catalog if r["sk"] == "META")
    if is_open(meta):
        return None
    spans = window.spans(meta, catalog)
    at = window.now()
    aired = [n for n, (opens, _) in spans.items() if opens is not None and opens <= at]
    n = window.active(meta, spans, at) or max(aired, default=None)
    if n is None:
        return None
    eps = {int(r["sk"].removeprefix("EP#")): r for r in catalog if r["sk"].startswith("EP#")}
    episode = eps[n]
    contestants = [r for r in catalog if r["sk"].startswith("CONTESTANT#")]
    pk = episode_pk(show, season, n)
    perfs, scores = query_many([("PERFORMANCES_TABLE", pk), ("SCORES_TABLE", pk)])
    keys = rateable(n, episode, contestants, perfs)
    return {
        "ep": n,
        "week": episode.get("week"),
        "rateable": len(keys),
        "answered": {m: len(answered(m, scores) & set(keys)) for m in sorted(members)},
    }
