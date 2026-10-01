"""
GET /users/get?season=dwts-35|all[&sub=<sub>] - a profile: display name, photo,
member since, a season summary with its leaderboard place, an all-time summary,
recent activity, a breakdown of how they score (`detail`) and every season
they've scored (`history`). Without `sub`, or with the caller's own, it also
carries the caller's group count and their scored dances; with anyone else's,
the friends and groups the two share.

Accuracy is built from gate.visible_scores on the profile owner's side, so it
only covers dances they answered. Someone else's summary is aggregates only,
and their mean error and per-judge errors appear once they have MIN_DANCES, the
leaderboard floor (docs/features/v2/PLAN.md): below it one number can be one
dance's gap, a per-dance value the viewer may never have answered.

`detail` takes the other route: for someone else it covers only the dances the
viewer has answered too, which the gate already shows the viewer on each
episode's results, so it needs no floor. On a past season (gate.is_open) the
gate shows every dance, so it covers them all. It is still means and counts,
plus the one dance each side of them the owner called best and worst.

All-time, places and history are the leaderboard's BOARD rows through
gate.standing and gate.places, with the same floor. `season=all` sums every
DWTS season the owner has a dance counted in. Recent activity is how many
dances they answered and scored per episode: counts, never a value.
"""

from __future__ import annotations

import math
from collections import defaultdict

from lambdas.common import board_dynamo
from lambdas.common.accuracy import errors, summary
from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.couples import people
from lambdas.common.dynamo import query_all, table
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
    scores,
    season_index,
    season_ref,
    season_rows,
)
from lambdas.common.gate import (
    answered,
    cid,
    is_open,
    perf_key,
    places,
    score_owner,
    standing,
    visible_scores,
)
from lambdas.common.social_dynamo import peer, peers, status
from lambdas.common.users_dynamo import cards

MIN_DANCES = 5
RECENT = 5
# The only show with past seasons to sum across.
SHOW = "dwts"


@api_handler("users_get")
def handler(event, context):
    caller = caller_sub(event)
    params = query(event)
    sub = params.get("sub") or caller
    own = sub == caller
    every = params.get("season") == board_dynamo.ALL
    show, season = (SHOW, None) if every else season_ref(params)

    user = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    # A block either way hides the profile, answering like a sub that doesn't exist.
    if user is None or (not own and status(peer(caller, sub)) == "blocked"):
        raise NotFoundError("No such user")

    numbers = sorted(int(s["number"]) for s in season_index(show))
    scored = board_dynamo.seasons_with(sub, show, numbers)
    dances, shared, activity = [], [], []
    for n in scored if every else [season]:
        mine, both, acts = _dances(sub, show, n, caller)
        dances += mine
        shared += both
        activity += acts

    boards: dict = {}

    def place(key: int | str) -> dict:
        if key not in boards:
            rows = board_dynamo.rows(show, key)
            board = {s: standing(r) for s, r in rows.items() if r.get("n")}
            boards[key] = (board, places(board, MIN_DANCES))
        board, ranks = boards[key]
        row = board.get(sub, standing(None))
        if not own and row["count"] < MIN_DANCES:
            row = {"count": row["count"], "mae": None, "closestJudge": None}
        return {**row, "rank": ranks.get(sub), "ranked": len(ranks)}

    totals = summary(dances)
    if not own and totals["count"] < MIN_DANCES:
        totals = {"count": totals["count"], "mae": None, "judges": {}}
    here = place(board_dynamo.ALL if every else season)
    all_time = place(board_dynamo.ALL)
    friends = {s for s, p in peers(sub).items() if status(p) == "friend"}

    profile = {
        "sub": sub,
        "name": user.get("name"),
        "picture": user.get("picture"),
        "avatarKind": user.get("avatarKind"),
        "memberSince": user.get("createdAt"),
        "friendCount": len(friends),
        "season": {
            "season": board_dynamo.ALL if every else f"{show}-{season}",
            **totals,
            "rank": here["rank"],
            "ranked": here["ranked"],
        },
        "allTime": all_time,
        "recent": sorted(activity, key=_when, reverse=True)[:RECENT],
        "detail": _detail(shared),
        "history": [
            {"season": f"{show}-{n}", **{k: v for k, v in place(n).items() if k != "closestJudge"}}
            for n in reversed(scored)
        ],
    }
    if own:
        profile["groupCount"] = len(_groups(sub))
        profile["dances"] = [
            {
                **{k: d[k] for k in ("ep", "key", "style", "paddle", "panelMean")},
                "error": round(d["error"], 2),
            }
            for d in dances
        ]
    else:
        mine = {s for s, p in peers(caller).items() if status(p) == "friend"}
        people = cards(mine & friends)
        profile["mutual"] = {
            "friends": sorted(people.values(), key=lambda p: (p["name"] or "").casefold()),
            "groups": _shared_groups(caller, sub),
        }
    return ok(profile)


def _dances(sub: str, show: str, season: int, viewer: str) -> tuple[list, list, list]:
    """
    The owner's error rows for the season, each with its season, episode, week
    and dance style; the subset on performances `viewer` answered too; and per
    episode they answered anything in, how many dances they answered and scored.
    """
    rows = {r["sk"]: r for r in season_rows(show, season)}
    if "META" not in rows:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    roster = {cid(r): r["members"] for sk, r in rows.items() if sk.startswith("CONTESTANT#")}
    opened = is_open(rows["META"])
    out, shared, activity = [], [], []
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
                "season": f"{show}-{season}",
                "ep": n,
                **{k: episode.get(k) for k in ("week", "theme", "airDate")},
                "answered": len(own),
                "scored": sum("value" in r for r in own),
            }
        )
        perfs = performances(pk)
        style = {perf_key(p["sk"]): p.get("style") for p in perfs}
        panel = episode.get("panel") or rows["META"]["defaultPanel"]
        seen = answered(viewer, score_rows)
        # An empty member set keeps only the owner's own rows.
        for d in errors(panel, perfs, visible_scores(sub, score_rows, set())).get(sub, []):
            row = {
                "season": f"{show}-{season}",
                "ep": n,
                "week": episode.get("week"),
                "style": style.get(d["key"]),
                # A team dance's key names every member couple: "a+b+c#1".
                "members": [
                    m
                    for c in d["key"].rsplit("#", 1)[0].split("+")
                    for m in people(roster.get(c, []))
                ],
                **d,
            }
            out.append(row)
            if opened or d["key"] in seen:
                shared.append(row)
    return out, shared, activity


def _when(row: dict) -> tuple[int, int]:
    """Sort key for anything with a season and an episode: dwts-9 before dwts-35."""
    return int(row["season"].rsplit("-", 1)[1]), row["ep"]


def _mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 2) if xs else None


def _averages(rows: list[dict]) -> dict:
    return {
        "count": len(rows),
        "mae": _mean([r["error"] for r in rows]),
        "paddle": _mean([r["paddle"] for r in rows]),
        "judges": _mean([r["panelMean"] for r in rows]),
    }


def _call(r: dict) -> dict:
    return {
        **{
            k: r[k]
            for k in ("season", "ep", "week", "key", "style", "members", "paddle", "panelMean")
        },
        "error": round(r["error"], 2),
    }


def _detail(rows: list[dict]) -> dict:
    """
    How the owner scores over these dances: against the panel overall and per
    judge, signed (`gap`, paddle minus panel mean), per style, per episode, a
    paddle histogram beside the panel mean's, and the best and worst call.
    """
    by_style = defaultdict(list)
    by_episode = defaultdict(list)
    for r in rows:
        if r["style"]:
            by_style[r["style"]].append(r)
        by_episode[_when(r)].append(r)
    styles = [{"style": s, **_averages(rs)} for s, rs in by_style.items()]
    # min and max keep the first of a tie, so the earliest dance wins it.
    best = min(rows, key=lambda r: r["error"], default=None)
    worst = max(rows, key=lambda r: r["error"], default=None)
    return {
        **summary(rows),
        "gap": _mean([r["paddle"] - r["panelMean"] for r in rows]),
        "styles": sorted(styles, key=lambda s: (s["mae"], -s["count"], s["style"])),
        "weeks": [
            {"season": rs[0]["season"], "ep": ep, "week": rs[0]["week"], **_averages(rs)}
            for (_, ep), rs in sorted(by_episode.items())
        ],
        "distribution": [
            {
                "score": n,
                "you": sum(r["paddle"] == n for r in rows),
                # Half up, as the client rounds; Python's round() would send 8.5 to 8.
                "judges": sum(math.floor(r["panelMean"] + 0.5) == n for r in rows),
            }
            for n in range(1, 11)
        ],
        "best": best and _call(best),
        "worst": worst and _call(worst),
    }


def _groups(sub: str) -> set[str]:
    return {r["sk"].removeprefix("GROUP#") for r in query_all(table("GROUPS_TABLE"), f"USER#{sub}")}


def _shared_groups(a: str, b: str) -> list[dict]:
    """Groups both are in, which the caller can already see as a member."""
    out = []
    for gid in sorted(_groups(a) & _groups(b)):
        group = table("GROUPS_TABLE").get_item(Key={"pk": f"GROUP#{gid}", "sk": "META"}).get("Item")
        # A delete in progress: the link outlived the group by a moment.
        if group:
            out.append({"id": gid, "name": group["name"]})
    return sorted(out, key=lambda g: g["name"].casefold())
