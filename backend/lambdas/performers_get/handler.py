"""
GET /performers/get?season=dwts-35|all[&group=<gid>] - how the caller scored
each couple against the judges, and how their friends and everyone else scored
the same dances.

Per couple: the caller's average paddle, the judges' average, the signed and
absolute gap (paddle minus panel mean), dances, best and worst dance by the
caller's paddle, each dance for a chart, and friends' and everyone else's
averages. Then the same per pro and per celebrity, and the caller's favorites,
least favorites, and the couples they're softest and toughest on.

Every number comes from common/couples.py over performances the caller
paddled, so an unanswered or skipped dance never counts, for anyone. Other
people appear only as means over at least couples.MIN_RATERS of them. `group`
narrows friends and everyone to that group's members and is 403 unless the
caller is one. `season=all` covers every DWTS season where the caller has a
dance counted on the leaderboard. Identity is the Cognito sub.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common import board_dynamo
from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.couples import crowd, dances, friends, group_pool, people, summary
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
    scores,
    season_index,
    season_ref,
    season_rows,
)
from lambdas.common.gate import answered, cid

HIGHLIGHTS = 3
# The only show with past seasons to sum across.
SHOW = "dwts"


@api_handler("performers_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    pool = group_pool(sub, params["group"]) if params.get("group") else None
    mates = friends(sub)
    if pool is not None:
        mates &= pool

    if params.get("season") == board_dynamo.ALL:
        show, label = SHOW, board_dynamo.ALL
        numbers = sorted(int(s["number"]) for s in season_index(show))
        seasons = board_dynamo.seasons_with(sub, show, numbers)
    else:
        show, season = season_ref(params)
        label = f"{show}-{season}"
        seasons = [season]

    couples = []
    raw = {}
    for season in seasons:
        rows = {r["sk"]: r for r in season_rows(show, season)}
        if "META" not in rows:
            raise NotFoundError("No such season", season=f"{show}-{season}")
        roster = {cid(r): r for sk, r in rows.items() if sk.startswith("CONTESTANT#")}
        by_couple = defaultdict(list)
        for sk, episode in sorted(rows.items()):
            if not sk.startswith("EP#"):
                continue
            pk = episode_pk(show, season, int(sk.removeprefix("EP#")))
            score_rows = scores(pk)
            if not answered(sub, score_rows):
                continue
            panel = episode.get("panel") or rows["META"]["defaultPanel"]
            for d in dances(sub, episode, panel, performances(pk), score_rows, pool):
                by_couple[d["couple"]].append(d)
        for c, ds in by_couple.items():
            if c in roster:
                couple = _couple(f"{show}-{season}", roster[c], ds, mates)
                couples.append(couple)
                raw[couple["ref"]] = ds

    rated = sorted(couples, key=lambda c: (-c["you"], -c["dances"]))
    favorites = rated[:HIGHLIGHTS]
    least = rated[HIGHLIGHTS:][::-1][:HIGHLIGHTS]
    gapped = sorted((c for c in couples if c["gap"] is not None), key=lambda c: -c["gap"])
    return ok(
        {
            "season": label,
            "group": params.get("group"),
            "couples": rated,
            "pros": _by_member(couples, raw, "pro"),
            "celebrities": _by_member(couples, raw, "celebrity"),
            "favorites": [c["ref"] for c in favorites],
            "leastFavorites": [c["ref"] for c in least],
            "softerOn": [c["ref"] for c in gapped if c["gap"] > 0][:HIGHLIGHTS],
            "tougherOn": [c["ref"] for c in reversed(gapped) if c["gap"] < 0][:HIGHLIGHTS],
        },
        meta={"couples": len(couples), "seasons": len(seasons)},
    )


def _couple(season: str, contestant: dict, ds: list[dict], mates: set[str]) -> dict:
    ds = sorted(ds, key=lambda d: (d["ep"], d["key"]))
    return {
        # A returning all-star keeps their id, so the season tells two runs apart.
        "ref": f"{season}/{cid(contestant)}",
        "id": cid(contestant),
        "season": season,
        "members": people(contestant["members"]),
        **summary(ds),
        "friends": crowd(ds, mates),
        "everyone": crowd(ds),
        "best": _dance(max(ds, key=lambda d: d["paddle"])),
        "worst": _dance(min(ds, key=lambda d: d["paddle"])),
        "weeks": [_dance(d) for d in ds],
    }


def _dance(d: dict) -> dict:
    return {k: d[k] for k in ("ep", "week", "key", "style", "paddle", "judges")}


def _by_member(couples: list[dict], raw: dict[str, list[dict]], role: str) -> list[dict]:
    """Couples summed by the person in one role, by name, which is all that links seasons."""
    grouped = defaultdict(list)
    for c in couples:
        member = next((m for m in c["members"] if m["role"] == role), None)
        if member:
            grouped[member["name"]].append((c, member))
    out = []
    for name, entries in grouped.items():
        ds = [d for c, _ in entries for d in raw[c["ref"]]]
        out.append(
            {
                "name": name,
                "headshot": next((m["headshot"] for _, m in entries if m["headshot"]), None),
                "seasons": sorted({c["season"] for c, _ in entries}),
                "couples": len(entries),
                **summary(ds),
            }
        )
    return sorted(out, key=lambda p: (-p["you"], -p["dances"]))
