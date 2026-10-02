"""
GET /performers/get?season=dwts-35|all[&show=dwts][&group=<gid>|&sub=<sub>] - how the
caller, or the user `sub`, scored each couple against the judges, and how the
caller's friends and everyone else scored the same dances.

Per couple: the caller's average paddle, the judges' average, the signed and
absolute gap (paddle minus panel mean), dances, best and worst dance by the
caller's paddle, each dance for a chart, and friends' and everyone else's
averages, and `eliminated` ({ep, week}) once the caller has finished that
episode (gate.results_open). Then the same per pro and per celebrity, and
the caller's favorites, least favorites, the couples they're softest and
toughest on, and their average paddle per dance style.

Every number comes from common/couples.py over performances the caller
paddled, so an unanswered or skipped dance never counts, for anyone. Other
people appear only as means over at least couples.MIN_RATERS of them. `group`
narrows friends and everyone to that group's members and is 403 unless the
caller is one. `season=all` covers every season of `show`, dwts by default,
where the caller has a dance counted on the leaderboard.

With someone else's `sub` it is that user's numbers, over only the dances the
caller has answered too, so nothing comes from a performance the gate keeps
from the caller; on a past season (gate.is_open) it keeps nothing back. Even
then no single dance goes out: couples lose their best, worst and per-week
rows. A block either way answers 404, like an unknown sub, and `group` can't be
combined with it. Identity is the Cognito sub.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common import board_dynamo
from lambdas.common.api import (
    NotFoundError,
    ValidationError,
    api_handler,
    caller_sub,
    ok,
    query,
)
from lambdas.common.couples import crowd, dances, friends, group_pool, people, summary
from lambdas.common.dynamo import table
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
    scores,
    season_index,
    season_ref,
    season_rows,
    show_ref,
)
from lambdas.common.gate import answered, cid, eliminated, is_open, results_open, visible_scores
from lambdas.common.social_dynamo import peer, status

HIGHLIGHTS = 3


@api_handler("performers_get")
def handler(event, context):
    caller = caller_sub(event)
    params = query(event)
    sub = params.get("sub") or caller
    own = sub == caller
    if not own:
        if params.get("group"):
            raise ValidationError("group and sub can't be combined", field="group")
        user = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
        if user is None or status(peer(caller, sub)) == "blocked":
            raise NotFoundError("No such user")
    pool = group_pool(caller, params["group"]) if params.get("group") else None
    mates = friends(caller)
    if pool is not None:
        mates &= pool

    if params.get("season") == board_dynamo.ALL:
        show, label = show_ref(params), board_dynamo.ALL
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
        contestants = list(roster.values())
        meta = rows["META"]
        opened = is_open(meta)
        by_couple = defaultdict(list)
        out = {}
        for sk, episode in sorted(rows.items()):
            if not sk.startswith("EP#"):
                continue
            n = int(sk.removeprefix("EP#"))
            pk = episode_pk(show, season, n)
            score_rows = scores(pk)
            perfs = None
            gone = eliminated(n, contestants)
            # The caller's results, not the owner's: someone else having finished
            # an episode tells the caller nothing.
            if gone and (opened or answered(caller, score_rows)):
                perfs = performances(pk)
                if results_open(caller, n, meta, episode, contestants, perfs, score_rows):
                    out.update({c: {"ep": n, "week": episode.get("week")} for c in gone})
            if not own:
                # Members None: every row on what the caller answered, the owner's among them.
                score_rows = visible_scores(caller, score_rows, opened=opened)
            if not answered(sub, score_rows):
                continue
            panel = episode.get("panel") or meta["defaultPanel"]
            perfs = perfs if perfs is not None else performances(pk)
            for d in dances(sub, episode, panel, perfs, score_rows, pool):
                by_couple[d["couple"]].append(d)
        for c, ds in by_couple.items():
            if c in roster:
                couple = _couple(f"{show}-{season}", roster[c], ds, mates, own)
                couple["eliminated"] = out.get(c)
                couples.append(couple)
                raw[couple["ref"]] = ds

    rated = sorted(couples, key=lambda c: (-c["you"], -c["dances"]))
    favorites = rated[:HIGHLIGHTS]
    least = rated[HIGHLIGHTS:][::-1][:HIGHLIGHTS]
    gapped = sorted((c for c in couples if c["gap"] is not None), key=lambda c: -c["gap"])
    return ok(
        {
            "sub": sub,
            "season": label,
            "group": params.get("group"),
            "couples": rated,
            "pros": _by_member(couples, raw, "pro"),
            "celebrities": _by_member(couples, raw, "celebrity"),
            "styles": _by_style([d for ds in raw.values() for d in ds]),
            "favorites": [c["ref"] for c in favorites],
            "leastFavorites": [c["ref"] for c in least],
            "softerOn": [c["ref"] for c in gapped if c["gap"] > 0][:HIGHLIGHTS],
            "tougherOn": [c["ref"] for c in reversed(gapped) if c["gap"] < 0][:HIGHLIGHTS],
        },
        meta={"couples": len(couples), "seasons": len(seasons)},
    )


def _couple(season: str, contestant: dict, ds: list[dict], mates: set[str], own: bool) -> dict:
    ds = sorted(ds, key=lambda d: (d["ep"], d["key"]))
    out = {
        # A returning all-star keeps their id, so the season tells two runs apart.
        "ref": f"{season}/{cid(contestant)}",
        "id": cid(contestant),
        "season": season,
        "members": people(contestant["members"]),
        **summary(ds),
        "friends": crowd(ds, mates),
        "everyone": crowd(ds),
    }
    if own:
        out["best"] = _dance(max(ds, key=lambda d: d["paddle"]))
        out["worst"] = _dance(min(ds, key=lambda d: d["paddle"]))
        out["weeks"] = [_dance(d) for d in ds]
    return out


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


def _by_style(ds: list[dict]) -> list[dict]:
    """Dances summed by style, highest average paddle first. Unknown styles are left out."""
    grouped = defaultdict(list)
    for d in ds:
        if d["style"]:
            grouped[d["style"]].append(d)
    out = [{"style": style, **summary(rows)} for style, rows in grouped.items()]
    return sorted(out, key=lambda s: (-s["you"], -s["dances"], s["style"]))
