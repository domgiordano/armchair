"""
GET /users/get?season=dwts-35[&sub=<sub>] - a profile: display name, photo,
member since, a season summary, an all-time summary and recent activity.
Without `sub`, or with the caller's own, it also carries the caller's group
count and their scored dances.

Accuracy is built from gate.visible_scores on the profile owner's side, so it
only covers dances they answered. Someone else's summary is aggregates only,
and their mean error and per-judge errors appear once they have MIN_DANCES, the
leaderboard floor (docs/features/v2/PLAN.md): below it one number can be one
dance's gap, a per-dance value the viewer may never have answered.

All-time is the leaderboard's BOARD#dwts#all row through gate.standing, with
the same floor. Recent activity is the owner's latest episodes this season with
how many dances they answered and scored: counts, never a value.
"""

from __future__ import annotations

from lambdas.common import board_dynamo
from lambdas.common.accuracy import errors, summary
from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_all, table
from lambdas.common.episodes_dynamo import episode_pk, performances, scores, season_ref, season_rows
from lambdas.common.gate import answered, perf_key, score_owner, standing, visible_scores
from lambdas.common.social_dynamo import peer, peers, status

MIN_DANCES = 5
RECENT = 5


@api_handler("users_get")
def handler(event, context):
    caller = caller_sub(event)
    params = query(event)
    show, season = season_ref(params)
    sub = params.get("sub") or caller
    own = sub == caller

    user = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    # A block either way hides the profile, answering like a sub that doesn't exist.
    if user is None or (not own and status(peer(caller, sub)) == "blocked"):
        raise NotFoundError("No such user")
    dances, activity = _dances(sub, show, season)
    totals = summary(dances)
    all_time = standing(board_dynamo.rows(show, board_dynamo.ALL, {sub}).get(sub))
    if not own and totals["count"] < MIN_DANCES:
        totals = {"count": totals["count"], "mae": None, "judges": {}}
    if not own and all_time["count"] < MIN_DANCES:
        all_time = {"count": all_time["count"], "mae": None, "closestJudge": None}

    profile = {
        "sub": sub,
        "name": user.get("name"),
        "picture": user.get("picture"),
        "avatarKind": user.get("avatarKind"),
        "memberSince": user.get("createdAt"),
        "friendCount": sum(status(p) == "friend" for p in peers(sub).values()),
        "season": {"season": f"{show}-{season}", **totals},
        "allTime": all_time,
        "recent": activity[::-1][:RECENT],
    }
    if own:
        profile["groupCount"] = len(query_all(table("GROUPS_TABLE"), f"USER#{sub}"))
        profile["dances"] = [
            {
                **{k: d[k] for k in ("ep", "key", "style", "paddle", "panelMean")},
                "error": round(d["error"], 2),
            }
            for d in dances
        ]
    return ok(profile)


def _dances(sub: str, show: str, season: int) -> tuple[list[dict], list[dict]]:
    """
    The owner's error rows for the season, each with its episode and dance style,
    and per episode they answered anything in, how many dances they answered and scored.
    """
    rows = {r["sk"]: r for r in season_rows(show, season)}
    if "META" not in rows:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    out = []
    activity = []
    for sk, episode in sorted(rows.items()):
        if not sk.startswith("EP#"):
            continue
        n = int(sk.removeprefix("EP#"))
        pk = episode_pk(show, season, n)
        score_rows = scores(pk)
        if not answered(sub, score_rows):
            continue
        own = [r for r in score_rows if score_owner(r)[1] == sub]
        activity.append(
            {
                "ep": n,
                **{k: episode.get(k) for k in ("week", "theme", "airDate")},
                "answered": len(own),
                "scored": sum("value" in r for r in own),
            }
        )
        perfs = performances(pk)
        style = {perf_key(p["sk"]): p.get("style") for p in perfs}
        panel = episode.get("panel") or rows["META"]["defaultPanel"]
        # An empty member set keeps only the owner's own rows.
        mine = errors(panel, perfs, visible_scores(sub, score_rows, set())).get(sub, [])
        out += [{"ep": n, "style": style.get(d["key"]), **d} for d in mine]
    return out, activity
