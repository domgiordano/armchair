"""
GET /week-board/get?season=dwts-35&ep=05[&scope=global|friends|group][&group=<gid>] -
one episode's couples ranked four ways: by the judges' average, by the caller's
paddles, by friends' average and by everyone else's, plus where the caller's
ranking and the judges' disagreed most.

Every number comes from common/couples.py over performances the caller paddled.
A couple the caller hasn't paddled is listed as locked, with no numbers, in
alphabetical order as gate.episode_view lists unanswered cards. `eliminated`
is who went home that night, once gate.results_open lets the caller know. A
past season (gate.is_open), or an episode whose scoring window has closed
(common/window.py, `window`), ranks every couple and locks none; `you` is None
where the caller has no paddle. Other people appear only as means over at least
couples.MIN_RATERS of them. `scope=global` is everyone; `scope=friends` narrows
everyone to the caller's friends; `scope=group` narrows both friends and
everyone to the group's members and is 403 unless the caller is one. Identity
is the Cognito sub.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common import window
from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query, require
from lambdas.common.couples import crowd, dances, friends, group_pool, mean, people
from lambdas.common.episodes_dynamo import (
    episode_pk,
    episode_rows,
    performances,
    ref,
    scores,
    season_rows,
)
from lambdas.common.gate import answered, cid, eliminated, is_open, rateable, results_open

DISAGREEMENTS = 3
COLUMNS = ("judges", "you", "friends", "everyone")


@api_handler("week_board_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, season, ep = ref(params)
    scope = params.get("scope") or "global"
    mates = friends(sub)
    gid = None
    if scope == "global":
        pool = None
    elif scope == "friends":
        pool = mates | {sub}
    elif scope == "group":
        (gid,) = require(params, "group")
        pool = group_pool(sub, gid)
        mates &= pool
    else:
        raise ValidationError("scope must be global, friends or group", field="scope")

    items = season_rows(show, season)
    meta, episode, contestants = episode_rows(items, show, season, ep)
    span = window.spans(meta, items)[ep]
    now = window.now()
    closed = window.closed(meta, span, now)
    pk = episode_pk(show, season, ep)
    perfs = performances(pk)
    score_rows = scores(pk)
    panel = episode.get("panel") or meta["defaultPanel"]
    keys = rateable(ep, episode, contestants, perfs)
    done = answered(sub, score_rows)
    opened = is_open(meta) or closed

    by_couple = defaultdict(list)
    for d in dances(sub, episode, panel, perfs, score_rows, pool, opened):
        by_couple[d["couple"]].append(d)

    roster = {cid(c): c for c in contestants}
    on_floor = [c for c in dict.fromkeys(k.rsplit("#", 1)[0] for k in keys) if c in roster]
    rows = []
    locked = []
    for c in sorted(on_floor, key=lambda c: _celebrity(roster[c]).casefold()):
        ds = by_couple.get(c)
        if not ds:
            # An open season hides nothing; a couple with no dance row has nothing to rank.
            if not opened:
                locked.append({"id": c, "members": people(roster[c]["members"])})
            continue
        scored = [d for d in ds if d["judges"] is not None]
        rows.append(
            {
                "id": c,
                "members": people(roster[c]["members"]),
                "dances": len(ds),
                "styles": [d["style"] for d in ds],
                "you": mean([d["paddle"] for d in ds if d["paddle"] is not None]),
                # Over the dances the judges have confirmed, which may be fewer.
                "judges": mean([d["judges"] for d in scored]),
                "judgesTotal": sum(d["total"] for d in scored) if scored else None,
                "friends": crowd(ds, mates)["mean"],
                "everyone": crowd(ds)["mean"],
            }
        )

    for col in COLUMNS:
        for r, rank in zip(rows, _ranks([r[col] for r in rows])):
            r.setdefault("ranks", {})[col] = rank
    for r in rows:
        judges, you = r["ranks"]["judges"], r["ranks"]["you"]
        # Positive: the caller placed them higher than the judges did.
        r["rankDelta"] = judges - you if judges and you else None

    split = [r for r in rows if r["rankDelta"]]
    split.sort(key=lambda r: (-abs(r["rankDelta"]), -abs(r["you"] - r["judges"])))
    return ok(
        {
            "season": f"{show}-{season}",
            "ep": ep,
            "week": episode.get("week"),
            "theme": episode.get("theme"),
            "panel": panel,
            "scope": scope,
            "group": gid,
            "open": is_open(meta),
            "window": window.view(meta, span, now),
            "rateable": len(keys),
            "answered": sum(k in done for k in keys),
            "couples": rows,
            "locked": locked,
            "disagreements": [r["id"] for r in split[:DISAGREEMENTS]],
            "eliminated": eliminated(ep, contestants)
            if results_open(sub, ep, meta, episode, contestants, perfs, score_rows, closed)
            else [],
        }
    )


def _celebrity(contestant: dict) -> str:
    return next(m["name"] for m in contestant["members"] if m["role"] == "celebrity")


def _ranks(values: list[float | None]) -> list[int | None]:
    """Highest first; ties share a rank and the next one skips, as a scoreboard does."""
    return [None if v is None else 1 + sum(w is not None and w > v for w in values) for v in values]
