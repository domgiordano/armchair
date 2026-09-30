"""
GET /stats/get?season=dwts-35[&ep=05] - the caller's accuracy against the
judges, for the season or one episode, and everyone else's over the same set.

Every number is computed from gate.visible_scores, so a performance the caller
hasn't answered never counts, for them or for anyone else. Identity is the
Cognito sub.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common.accuracy import errors, summary
from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
    ref,
    scores,
    season_ref,
    season_rows,
)
from lambdas.common.gate import answered, visible_scores


@api_handler("stats_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, season, ep = ref(params) if params.get("ep") else (*season_ref(params), None)
    rows = {r["sk"]: r for r in season_rows(show, season)}
    if "META" not in rows:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    episodes = sorted(
        (int(sk.removeprefix("EP#")), r) for sk, r in rows.items() if sk.startswith("EP#")
    )
    if ep is not None:
        episodes = [(n, r) for n, r in episodes if n == ep]
        if not episodes:
            raise NotFoundError("No such episode", season=f"{show}-{season}", ep=ep)

    mine = []
    per_episode = []
    everyone = defaultdict(list)
    for n, episode in episodes:
        pk = episode_pk(show, season, n)
        score_rows = scores(pk)
        if not answered(sub, score_rows):
            continue
        panel = episode.get("panel") or rows["META"]["defaultPanel"]
        by_owner = errors(panel, performances(pk), visible_scores(sub, score_rows))
        for owner, errs in by_owner.items():
            everyone[owner] += errs
        if by_owner.get(sub):
            per_episode.append({"ep": n, **summary(by_owner[sub])})
            mine += [{"ep": n, **e} for e in by_owner[sub]]

    others = [
        {"sub": owner, "count": len(errs), "mae": summary(errs)["mae"]}
        for owner, errs in everyone.items()
        if owner != sub
    ]
    return ok(
        {
            "season": f"{show}-{season}",
            "ep": ep,
            "mine": summary(mine),
            "episodes": per_episode,
            "dances": [
                {
                    **{k: d[k] for k in ("ep", "key", "paddle", "panelMean")},
                    "error": round(d["error"], 2),
                }
                for d in mine
            ],
            "others": sorted(others, key=lambda o: o["mae"]),
        }
    )
