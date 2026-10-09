"""
GET /stats/me?season=dwts-35[&ep=05][&sub=<sub>][&sealed=6:<key>,...] - one
person's breakdown against the judges: by week with their place among
everyone, by judge, dance style and couple, favorites and least favorites (the
couples and styles they score furthest above and below the judges), streaks
within a point, best and worst calls, and every call for the charts.

Built by common/stats.py over the dances the caller may see (gate.sees), so
someone else's breakdown (`sub`) covers only dances the caller has answered or
that are open to everyone, as users_get's `detail` does. A block either way
answers like a sub that doesn't exist. `ep` narrows everything to one episode.
The caller's locked-in, unrevealed dances (common/seals.py, and any `sealed`
names) leave every number. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.social_dynamo import peer, status
from lambdas.common.stats import calls, load, person
from lambdas.common.users_dynamo import card


@api_handler("stats_me")
def handler(event, context):
    caller = caller_sub(event)
    params = query(event)
    sub = params.get("sub") or caller
    who = card(sub)
    if sub != caller and (who is None or status(peer(caller, sub)) == "blocked"):
        raise NotFoundError("No such user")
    view = load(caller, params)
    cs = calls(view["digests"], caller, view["opened"], view["sealed"])
    return ok(
        {
            "season": view["season"],
            "ep": view["ep"],
            "person": who or {"sub": sub},
            "episodes": view["episodes"],
            **person(cs, sub, view["digests"], view["perEp"]),
            "eliminated": view["eliminated"],
        }
    )
