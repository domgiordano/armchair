"""
Stats over a season's digests (common/digest.py), as one viewer may see them.

The viewer sees a dance's judges, and everyone's paddle on it, once they have
answered it or once its episode is `opened`: a past season or a closed scoring
window, as gate.visible_scores rules. A dance they locked in without revealing
(`sealed`, sent by the client from lib/show/sealed.ts) counts as unseen too.
Every number here is built from `calls()`, which keeps only those dances, so a
dance the viewer can't see never reaches them through anyone's numbers.

A call is one person's paddle on one dance with every judge confirmed. `gap`
is paddle minus the panel mean, `error` its size.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable
from statistics import pstdev

from lambdas.common import digest, window
from lambdas.common.api import NotFoundError
from lambdas.common.couples import MIN_RATERS
from lambdas.common.episodes_dynamo import ref, season_ref, season_rows
from lambdas.common.gate import eliminated, places, sees

# The leaderboard's floor (leaderboard_get): fewer dances than this and a mean is luck.
MIN_DANCES = 5
TOP = 3
DIVISIVE = 5
CLOSE = 1.0


def seen(digests: list[dict], viewer: str, opened: set[int], sealed: set[tuple[int, str]]):
    """(digest, dance) for every dance the viewer may see with its judges confirmed."""
    for d in digests:
        mine = d["answers"].get(viewer, {})
        for x in d["dances"]:
            if x["judges"] is not None and sees(d["ep"], x["key"], mine, d["ep"] in opened, sealed):
                yield d, x


def calls(
    digests: list[dict], viewer: str, opened: set[int], sealed: set[tuple[int, str]]
) -> list[dict]:
    out = []
    for d, x in seen(digests, viewer, opened, sealed):
        mean = sum(x["judges"].values()) / len(x["judges"])
        for sub, answers in d["answers"].items():
            paddle = answers.get(x["key"])
            if not paddle:
                continue
            out.append(
                {
                    "ep": d["ep"],
                    "week": d["week"],
                    "key": x["key"],
                    "style": x["style"],
                    "couples": x["couples"],
                    "panel": x["judges"],
                    "judges": mean,
                    "sub": sub,
                    "paddle": paddle,
                    "gap": paddle - mean,
                    "error": abs(paddle - mean),
                }
            )
    return out


def _mean(xs: Iterable[float]) -> float | None:
    xs = list(xs)
    return round(sum(xs) / len(xs), 2) if xs else None


def _share(n: int, of: int) -> float | None:
    return round(n / of, 3) if of else None


def _by(cs: list[dict], field: str) -> dict[str, list[dict]]:
    out = defaultdict(list)
    for c in cs:
        out[c[field]].append(c)
    return out


def _exact(c: dict) -> bool:
    # Half up, as the client rounds; Python's round() would send 8.5 to 8.
    return math.floor(c["judges"] + 0.5) == c["paddle"]


def summary(cs: list[dict]) -> dict:
    """Mean error and bias (over-scoring is positive), and the shares dead on and within a point."""
    return {
        "count": len(cs),
        "mae": _mean(c["error"] for c in cs),
        "bias": _mean(c["gap"] for c in cs),
        "exact": _share(sum(map(_exact, cs)), len(cs)),
        "close": _share(sum(c["error"] <= CLOSE for c in cs), len(cs)),
    }


def _versus(cs: list[dict]) -> dict:
    """A summary beside the means it compares: your paddle and the judges'."""
    return {
        **summary(cs),
        "paddle": _mean(c["paddle"] for c in cs),
        "judges": _mean(c["judges"] for c in cs),
    }


def standings(cs: list[dict], floor: int) -> tuple[dict[str, dict], dict[str, int]]:
    """Each person's summary over `cs`, and places by gate.places with `floor` dances to rank."""
    board = {s: summary(v) for s, v in _by(cs, "sub").items()}
    return board, places(board, floor)


def _week_floor(dances: int) -> int:
    """Half the week's dances, so a week's leader didn't score one dance and stop."""
    return max(1, math.ceil(dances / 2))


def _solo(c: dict) -> bool:
    # A team dance is one paddle shared by several couples; it says nothing about any one.
    return len(c["couples"]) == 1


def call(c: dict) -> dict:
    """One dance as the breakdowns list it."""
    return {
        **{k: c[k] for k in ("ep", "week", "key", "style", "couples", "paddle")},
        "judges": round(c["judges"], 2),
        "panel": c["panel"],
        "gap": round(c["gap"], 2),
        "error": round(c["error"], 2),
    }


def _leanings(rows: list[dict], field: str, n: int = TOP) -> tuple[list[str], list[str]]:
    """The `field`s scored furthest above the judges and furthest below, more dances first in a tie."""
    up = sorted((r for r in rows if r["bias"] > 0), key=lambda r: (-r["bias"], -r["count"]))
    down = sorted((r for r in rows if r["bias"] < 0), key=lambda r: (r["bias"], -r["count"]))
    return [r[field] for r in up[:n]], [r[field] for r in down[:n]]


def _streaks(cs: list[dict]) -> dict:
    """Runs of calls within a point of the panel, in air order: the latest and the longest."""
    run = best = 0
    for c in sorted(cs, key=lambda c: (c["ep"], c["key"])):
        run = run + 1 if c["error"] <= CLOSE else 0
        best = max(best, run)
    return {"current": run, "best": best}


def person(cs: list[dict], sub: str, digests: list[dict], seen_per_ep: dict[int, int]) -> dict:
    """
    One person's breakdown over every call in `cs` they made: by week with
    their place among everyone in `cs` that week, by judge, style and couple,
    their favorites and least favorites, streaks, best and worst calls.
    """
    mine = [c for c in cs if c["sub"] == sub]
    _, ranks = standings(cs, MIN_DANCES)
    by_ep = _by(cs, "ep")
    weeks = []
    for d in digests:
        week = [c for c in by_ep.get(d["ep"], []) if c["sub"] == sub]
        if not week:
            continue
        _, week_ranks = standings(by_ep[d["ep"]], _week_floor(seen_per_ep.get(d["ep"], 0)))
        weeks.append(
            {
                "ep": d["ep"],
                "week": d["week"],
                "theme": d["theme"],
                **_versus(week),
                "rank": week_ranks.get(sub),
                "ranked": len(week_ranks),
            }
        )

    per_judge = defaultdict(list)
    for c in mine:
        for j, v in c["panel"].items():
            per_judge[j].append(c["paddle"] - v)
    judges = [
        {"id": j, "count": len(gs), "mae": _mean(map(abs, gs)), "bias": _mean(gs)}
        for j, gs in per_judge.items()
    ]
    styles = [{"style": s, **_versus(v)} for s, v in _by(mine, "style").items() if s]
    couples = [
        {"id": cid, **_versus(v)}
        for cid, v in _by(
            [{**c, "couple": c["couples"][0]} for c in mine if _solo(c)], "couple"
        ).items()
    ]
    favorites, least = _leanings(couples, "id")
    likes, dislikes = _leanings(styles, "style")
    ranked = sorted(mine, key=lambda c: (c["error"], -c["ep"]))
    return {
        "sub": sub,
        **_versus(mine),
        "rank": ranks.get(sub),
        "ranked": len(ranks),
        "weeks": weeks,
        "judges": sorted(judges, key=lambda j: (j["mae"], -j["count"])),
        "styles": sorted(styles, key=lambda s: (s["mae"], -s["count"], s["style"])),
        "couples": sorted(couples, key=lambda c: -c["bias"]),
        "favorites": favorites,
        "leastFavorites": least,
        "styleLikes": likes,
        "styleDislikes": dislikes,
        "streak": _streaks(mine),
        "best": [call(c) for c in ranked[:TOP]],
        "worst": [call(c) for c in reversed(ranked[-TOP:]) if c["error"] > 0],
        "distribution": [
            {
                "score": n,
                "you": sum(c["paddle"] == n for c in mine),
                "judges": sum(math.floor(c["judges"] + 0.5) == n for c in mine),
            }
            for n in range(1, 11)
        ],
        "calls": [call(c) for c in sorted(mine, key=lambda c: (c["ep"], c["key"]))],
    }


def _crowd(cs: list[dict], viewer: str) -> dict:
    """
    Paddles over some dances: their mean, spread and raters. Other people reach
    the viewer only as a mean over MIN_RATERS of them (common/couples.py), so
    fewer leaves the numbers out.
    """
    raters = {c["sub"] for c in cs}
    if len(raters - {viewer}) < MIN_RATERS:
        return {"raters": len(raters), "crowd": None, "spread": None, "delta": None}
    paddles = [c["paddle"] for c in cs]
    crowd = sum(paddles) / len(paddles)
    judges = sum(c["judges"] for c in cs) / len(cs)
    return {
        "raters": len(raters),
        "crowd": round(crowd, 2),
        "spread": round(pstdev(paddles), 2),
        "delta": round(crowd - judges, 2),
    }


def couples_by_week(cs: list[dict], viewer: str) -> list[dict]:
    """
    How the people in `cs` scored each couple, week by week and over the
    season, beside the judges: the "couple votes" view. Solo dances only.
    """
    solo = [{**c, "couple": c["couples"][0]} for c in cs if _solo(c)]
    out = []
    for cid, rows in _by(solo, "couple").items():
        weeks = [
            {
                "ep": ep,
                "week": v[0]["week"],
                "dances": len({c["key"] for c in v}),
                "judges": _mean(c["judges"] for c in {c["key"]: c for c in v}.values()),
                **_crowd(v, viewer),
            }
            for ep, v in sorted(_by(rows, "ep").items())
        ]
        dances = {(c["ep"], c["key"]): c for c in rows}
        out.append(
            {
                "id": cid,
                "dances": len(dances),
                "judges": _mean(c["judges"] for c in dances.values()),
                **_crowd(rows, viewer),
                "weeks": weeks,
            }
        )
    return sorted(out, key=lambda c: c["id"])


def crowd(
    cs: list[dict],
    viewer: str,
    digests: list[dict],
    seen_per_ep: dict[int, int],
    pool: set[str] | None,
    head_to_head: bool,
) -> dict:
    """
    Everyone in `pool` (None for everyone) over the calls in `cs`: leaders and
    standings week by week, each dance's crowd against the judges and the most
    divisive, couples and styles, and for a group of people who know each
    other (`head_to_head`) every member's card and who beat whom.
    """
    cs = [c for c in cs if pool is None or c["sub"] in pool]
    by_ep = _by(cs, "ep")
    weeks = []
    through: list[dict] = []
    for d in digests:
        week = by_ep.get(d["ep"], [])
        if not seen_per_ep.get(d["ep"]):
            continue
        through += week
        board, ranks = standings(week, _week_floor(seen_per_ep[d["ep"]]))
        overall, places_now = standings(through, MIN_DANCES)
        # Ranked first, then those still short of MIN_DANCES, most dances first.
        order = sorted(
            overall, key=lambda s: (s not in places_now, places_now.get(s, 0), -overall[s]["count"])
        )
        shown = order if head_to_head else [*[s for s in order if s in places_now][:TOP], viewer]
        weeks.append(
            {
                "ep": d["ep"],
                "week": d["week"],
                "theme": d["theme"],
                "dances": seen_per_ep[d["ep"]],
                "participants": len(board),
                **summary(week),
                "leaders": [
                    {"sub": s, "rank": ranks[s], **board[s]}
                    for s in sorted(ranks, key=lambda s: (ranks[s], -board[s]["count"]))[:TOP]
                ],
                "standings": [
                    {"sub": s, "rank": places_now.get(s), **overall[s]}
                    for s in dict.fromkeys(shown)
                    if s in overall
                ],
            }
        )

    dances = []
    for v in _by([{**c, "dance": (c["ep"], c["key"])} for c in cs], "dance").values():
        first = v[0]
        dances.append(
            {
                **{k: first[k] for k in ("ep", "week", "key", "style", "couples")},
                "judges": round(first["judges"], 2),
                **_crowd(v, viewer),
            }
        )
    dances.sort(key=lambda x: (x["ep"], x["key"]))
    divisive = sorted(
        (x for x in dances if x["spread"] is not None), key=lambda x: (-x["spread"], -x["raters"])
    )

    couples = couples_by_week(cs, viewer)
    styles = []
    for style, v in _by(cs, "style").items():
        if style:
            once = {(c["ep"], c["key"]): c for c in v}
            styles.append(
                {
                    "style": style,
                    "dances": len(once),
                    "judges": _mean(c["judges"] for c in once.values()),
                    **_crowd(v, viewer),
                }
            )
    rated = [
        {"id": c["id"], "bias": c["delta"], "count": c["dances"]}
        for c in couples
        if c["delta"] is not None
    ]
    favorites, least = _leanings(rated, "id")
    out = {
        **summary(cs),
        "raters": len({c["sub"] for c in cs}),
        "weeks": weeks,
        "dances": dances,
        "divisive": [{"ep": x["ep"], "key": x["key"]} for x in divisive[:DIVISIVE]],
        "couples": couples,
        "favorites": favorites,
        "leastFavorites": least,
        "styles": sorted(styles, key=lambda s: (-(s["delta"] or 0), s["style"])),
    }
    if head_to_head:
        out["members"] = _members(cs)
        out["headToHead"] = _head_to_head(cs)
    return out


def _members(cs: list[dict]) -> list[dict]:
    board, ranks = standings(cs, MIN_DANCES)
    out = []
    for sub, mine in _by(cs, "sub").items():
        styles = [{"style": s, **summary(v)} for s, v in _by(mine, "style").items() if s]
        couples = [
            {"id": cid, **summary(v)}
            for cid, v in _by(
                [{**c, "couple": c["couples"][0]} for c in mine if _solo(c)], "couple"
            ).items()
        ]
        likes, _ = _leanings(styles, "style", 1)
        favorite, least = _leanings(couples, "id", 1)
        best = min(styles, key=lambda s: (s["mae"], -s["count"]), default=None)
        out.append(
            {
                **board[sub],
                "sub": sub,
                "rank": ranks.get(sub),
                "favoriteStyle": likes[0] if likes else None,
                "bestStyle": best and best["style"],
                "favorite": favorite[0] if favorite else None,
                "leastFavorite": least[0] if least else None,
            }
        )
    return sorted(out, key=lambda m: (m["rank"] is None, m["rank"] or 0, -m["count"]))


def _head_to_head(cs: list[dict]) -> dict[str, dict[str, list[int]]]:
    """
    For each pair, over the dances both scored: [wins, losses, ties] from the
    first's side, closer to the panel mean winning.
    """
    by_dance = defaultdict(dict)
    for c in cs:
        by_dance[(c["ep"], c["key"])][c["sub"]] = c["error"]
    out: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))
    for errs in by_dance.values():
        for a, ea in errs.items():
            for b, eb in errs.items():
                if a != b:
                    out[a][b][0 if ea < eb else 1 if ea > eb else 2] += 1
    return {a: dict(row) for a, row in out.items()}


SEALED_MAX = 200


def sealed_param(params: dict) -> set[tuple[int, str]]:
    """
    `sealed=6:tyler-cameron#1,6:a+b#1`: dances the caller locked in without
    revealing, from the client's own list. Only ever narrows what they see.
    """
    out = set()
    for part in (params.get("sealed") or "").split(",")[:SEALED_MAX]:
        ep, _, key = part.partition(":")
        if ep.isdigit() and "#" in key:
            out.add((int(ep), key))
    return out


def load(sub: str, params: dict) -> dict:
    """
    The season as `sub` may see it: its digests (only up to `ep` when given),
    the episodes opened to everyone, the caller's seals, how many dances each
    episode shows them, and who went home on nights they may know of.
    """
    show, season = season_ref(params)
    rows = season_rows(show, season)
    meta = next((r for r in rows if r["sk"] == "META"), None)
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    digests = digest.season(show, season, rows)
    if params.get("ep"):
        _, _, ep = ref(params)
        digests = [d for d in digests if d["ep"] == ep]
    spans = window.spans(meta, rows)
    at = window.now()
    opened = {d["ep"] for d in digests if window.closed(meta, spans[d["ep"]], at)}
    sealed = sealed_param(params)
    per_ep = defaultdict(int)
    for d, _ in seen(digests, sub, opened, sealed):
        per_ep[d["ep"]] += 1
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    out = {}
    for d in digests:
        keys = [x["key"] for x in d["dances"]]
        mine = d["answers"].get(sub, {})
        # As gate.results_open, and a sealed dance keeps that night's result hidden too.
        known = d["ep"] in opened or (bool(keys) and all(k in mine for k in keys))
        if known and not any(ep == d["ep"] for ep, _ in sealed):
            out.update(
                {c: {"ep": d["ep"], "week": d["week"]} for c in eliminated(d["ep"], contestants)}
            )
    return {
        "season": f"{show}-{season}",
        "ep": int(params["ep"]) if params.get("ep") else None,
        "digests": digests,
        "opened": opened,
        "sealed": sealed,
        "perEp": dict(per_ep),
        "eliminated": out,
        "episodes": [
            {
                "ep": d["ep"],
                "week": d["week"],
                "theme": d["theme"],
                "dances": per_ep.get(d["ep"], 0),
            }
            for d in digests
        ],
    }
