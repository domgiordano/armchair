"""
GET /stats/get?season=dwts-35[&ep=05][&group=<gid>] - the caller's accuracy
against the judges, for the season or one episode, and everyone else's over the
same set. Each of the caller's dances carries its style and the panel's values,
for the charts on /stats/.

Every number is computed from gate.visible_scores, so a performance the caller
hasn't answered never counts, for them or for anyone else. `group` narrows
everyone else to that group's members and is 403 unless the caller is one.
Identity is the Cognito sub.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common.accuracy import errors, summary
from lambdas.common.api import ForbiddenError, NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, ref, season_ref, season_rows
from lambdas.common.gate import answered, perf_key, visible_scores
from lambdas.common.groups_dynamo import members


@api_handler("stats_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, season, ep = ref(params) if params.get("ep") else (*season_ref(params), None)
    group = params.get("group")
    in_group = None
    if group:
        in_group = members(group)
        # A group that doesn't exist answers the same, so a guess learns nothing.
        if sub not in in_group:
            raise ForbiddenError("Not a member of that group")
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

    # Every episode's reads in parallel. An unanswered episode's performances are
    # read and dropped, which costs less than a second round trip for the rest.
    pks = [episode_pk(show, season, n) for n, _ in episodes]
    found = query_many([(t, pk) for pk in pks for t in ("SCORES_TABLE", "PERFORMANCES_TABLE")])

    mine = []
    details = {}
    per_episode = []
    everyone = defaultdict(list)
    for i, (n, episode) in enumerate(episodes):
        score_rows, perfs = found[2 * i], found[2 * i + 1]
        if not answered(sub, score_rows):
            continue
        panel = episode.get("panel") or rows["META"]["defaultPanel"]
        by_owner = errors(panel, perfs, visible_scores(sub, score_rows, in_group))
        for owner, errs in by_owner.items():
            everyone[owner] += errs
        if by_owner.get(sub):
            per_episode.append({"ep": n, **summary(by_owner[sub])})
            mine += [{"ep": n, **e} for e in by_owner[sub]]
            # Only dances in `mine`, which the caller answered, ever read these.
            for p in perfs:
                details[(n, perf_key(p["sk"]))] = {
                    "style": p.get("style"),
                    "judges": {
                        j: p["judges"][j]["value"] for j in panel if j in p.get("judges", {})
                    },
                }

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
                    **details[(d["ep"], d["key"])],
                }
                for d in mine
            ],
            "others": sorted(others, key=lambda o: o["mae"]),
        }
    )
