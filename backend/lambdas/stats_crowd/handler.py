"""
GET /stats/crowd?season=dwts-35&scope=global|friends|group[&group=<gid>][&ep=05][&sealed=6:<key>,...]
- everyone in the scope against the judges: each week's leaders and the
standings after it, every dance's crowd mean, spread and gap to the judges,
the most divisive dances, couple votes by week (`couples`: how the scope scored
each couple each week beside the judges), styles, and the crowd's favorite and
least favorite couples. A friends or group scope adds each member's card, a
head-to-head of who called shared dances closer, and the same numbers for
everyone (`global`) to compare against.

Built by common/stats.py over the dances the caller may see (gate.sees), for
them and everyone else alike. Crowd means need MIN_RATERS people besides the
caller. `scope=group` is 403 unless the caller is a member; `friends` is the
caller and their accepted friends. `ep` narrows everything to one episode;
`sealed` lists the caller's locked-in, unrevealed dances, which no number
includes. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query, require
from lambdas.common.couples import friends, group_pool
from lambdas.common.stats import calls, crowd, load, summary
from lambdas.common.users_dynamo import cards


@api_handler("stats_crowd")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    scope = params.get("scope") or "global"
    gid = None
    if scope == "global":
        pool = None
    elif scope == "friends":
        pool = friends(sub) | {sub}
    elif scope == "group":
        (gid,) = require(params, "group")
        pool = group_pool(sub, gid)
    else:
        raise ValidationError("scope must be global, friends or group", field="scope")

    view = load(sub, params)
    cs = calls(view["digests"], sub, view["opened"], view["sealed"])
    out = crowd(cs, sub, view["digests"], view["perEp"], pool, head_to_head=pool is not None)
    if pool is not None:
        out["global"] = {
            **summary(cs),
            "weeks": [
                {"ep": d["ep"], **summary([c for c in cs if c["ep"] == d["ep"]])}
                for d in view["digests"]
                if view["perEp"].get(d["ep"])
            ],
        }
    named = set(pool or ()) | {
        r["sub"] for w in out["weeks"] for r in (*w["leaders"], *w["standings"])
    }
    return ok(
        {
            "season": view["season"],
            "ep": view["ep"],
            "scope": scope,
            "group": gid,
            "episodes": view["episodes"],
            "people": cards(named | {sub}),
            **out,
            "eliminated": view["eliminated"],
        }
    )
