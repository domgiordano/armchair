"""
GET /people/get?id=<person id>[&season=dwts-20] - one celebrity, pro or judge:
bio, roles, seasons with partners and results, the dances they danced and
judged, and all-time numbers.

Every aired episode read is built by gate.episode_view and only its cards are
used. A dance the caller hasn't answered comes back as {season, ep, week, key,
style, song, dancers, locked: true} and nothing else, enough to send them to
/episode/ to score it. A season's result shows once the caller has finished
every aired episode up to it, the episode rule; until then it is
{locked: true, season, ep} with the first episode left. Every all-time number
is over dances the caller has answered; friends are their accepted friends.
A past season (gate.is_open) has no gate, so its dances and results all show.

A judge or a long-serving pro spans hundreds of nights, so only some seasons
are read (`loaded`): the person's latest, the current one, `season`, every
season the caller has a leaderboard row in, and all of them for someone in
three or fewer. The numbers cover the seasons read. An unread season lists
no rows and its result is null. `season` also
narrows the dance lists, never the numbers, and picks which season of judging
to list, the latest by default. Identity is the Cognito sub.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from lambdas.common import board_dynamo, people
from lambdas.common.api import NotFoundError, ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_partitions
from lambdas.common.episodes_dynamo import episode_pk, season_index, season_ref
from lambdas.common.gate import cid, episode_view, is_open
from lambdas.common.social_dynamo import peers, status

SHOW = "dwts"
ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
EXTREMES = 3
# Someone in this many seasons or fewer has every season read.
FEW = 3


def _now() -> datetime:
    return datetime.now(UTC)


@api_handler("people_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    pid = str(params.get("id") or "")
    if not ID.fullmatch(pid) or len(pid) > 80:
        raise ValidationError("id is not a person id", field="id")
    only = season_ref(params)[1] if params.get("season") else None
    person = people.person(SHOW, pid)
    if person is None:
        raise NotFoundError("No such person", id=pid)

    stints = [{**s, "season": int(s["season"])} for s in person["seasons"]]
    numbers = {s["season"] for s in stints}
    judging = sorted(s["season"] for s in stints if s["role"] == "judge")
    shown = only if only in judging else (judging[-1] if judging else None)
    if len(numbers) <= FEW:
        wanted = numbers
    else:
        current = {int(r["number"]) for r in season_index(SHOW) if r.get("current")}
        scored = set(board_dynamo.seasons_with(sub, SHOW, sorted(numbers)))
        wanted = numbers & ({max(numbers), only, shown} | current | scored)
    seasons = _seasons(wanted)
    nights = [
        (s, _episodes(pid, s, seasons[s["season"]]) if s["season"] in seasons else None)
        for s in stints
    ]
    views = _views(
        sub, seasons, sorted({(s["season"], ep) for s, eps in nights for ep in eps or []})
    )
    friends = {s for s, item in peers(sub).items() if status(item) == "friend"}

    timeline, danced, judged = [], [], []
    for stint, eps in nights:
        n = stint["season"]
        entry = {
            "season": f"{SHOW}-{n}",
            "number": n,
            "role": stint["role"],
            "loaded": eps is not None,
        }
        if stint["role"] != "judge":
            entry["partners"] = stint["partners"]
            entry["result"] = None
        if eps is None:
            timeline.append(entry)
            continue
        mine = [
            _row(n, ep, seasons[n], card, friends)
            for ep in eps
            for card in views[(n, ep)]["performances"]
            if stint["role"] == "judge" or stint["couple"] in card["contestants"]
        ]
        (judged if stint["role"] == "judge" else danced).extend(mine)
        entry["dances"] = len(mine)
        entry["locked"] = sum(r["locked"] for r in mine)
        if stint["role"] != "judge":
            entry["result"] = _result(n, stint["couple"], seasons[n], views)
        timeline.append(entry)

    label = only and f"{SHOW}-{only}"
    return ok(
        {
            "id": pid,
            **{k: person.get(k) for k in ("name", "roles", "headshot", "bio", "facts")},
            "seasons": timeline,
            "performances": [r for r in danced if label in (None, r["season"])],
            "judged": shown
            and {
                "season": f"{SHOW}-{shown}",
                "rows": [r for r in judged if r["season"] == f"{SHOW}-{shown}"],
            },
            "stats": {
                "dancer": _dancer(danced) if danced else None,
                "judge": _judge(pid, judged) if judged else None,
            },
        }
    )


def _seasons(numbers: set[int]) -> dict[int, dict]:
    """Per season: META, episodes by number, contestants, and which episodes have aired."""
    rows = query_partitions("CATALOG_TABLE", [f"SEASON#{SHOW}#{n}" for n in sorted(numbers)])
    out = {}
    now = _now()
    for pk, items in rows.items():
        by_sk = {r["sk"]: r for r in items}
        meta = by_sk.get("META")
        if meta is None:
            continue
        tz = ZoneInfo(meta["timezone"])
        episodes = {
            int(sk.removeprefix("EP#")): r for sk, r in by_sk.items() if sk.startswith("EP#")
        }
        contestants = [r for r in items if r["sk"].startswith("CONTESTANT#")]
        out[int(pk.rsplit("#", 1)[1])] = {
            "meta": meta,
            "episodes": episodes,
            "contestants": contestants,
            "aired": sorted(n for n, e in episodes.items() if _aired(meta, e, tz, now)),
            # Each couple's dancers as people: a pro's id is their name's slug.
            "dancers": {
                cid(c): [
                    {
                        "id": cid(c) if m["role"] == "celebrity" else people.slug(m["name"]),
                        "name": m["name"],
                        "role": m["role"],
                    }
                    for m in c["members"]
                ]
                for c in contestants
            },
        }
    return out


def _aired(meta: dict, ep: dict, tz: ZoneInfo, now: datetime) -> bool:
    """overview_get's rule: a past season has no start times, and all of it has aired."""
    if is_open(meta):
        return True
    if not (ep.get("airDate") and ep.get("start")):
        return False
    return datetime.fromisoformat(f"{ep['airDate']}T{ep['start']}").replace(tzinfo=tz) <= now


def _episodes(pid: str, stint: dict, season: dict) -> list[int]:
    """
    Aired episodes the stint can have a card in: a judge's nights on the panel, a
    couple's nights up to the one they went out on. Only narrows the reads; each
    card is still picked from the episode's whole gated view.
    """
    if stint["role"] == "judge":
        default = season["meta"]["defaultPanel"]
        return [
            n for n in season["aired"] if pid in (season["episodes"][n].get("panel") or default)
        ]
    couple = next(c for c in season["contestants"] if cid(c) == stint["couple"])
    last = couple.get("eliminatedEp")
    return [n for n in season["aired"] if last is None or n <= last]


def _views(sub: str, seasons: dict[int, dict], eps: list[tuple[int, int]]) -> dict:
    pks = [episode_pk(SHOW, n, ep) for n, ep in eps]
    perfs = query_partitions("PERFORMANCES_TABLE", pks)
    scores = query_partitions("SCORES_TABLE", pks)
    out = {}
    for (n, ep), pk in zip(eps, pks):
        s = seasons[n]
        out[(n, ep)] = episode_view(
            sub, ep, s["meta"], s["episodes"][ep], s["contestants"], perfs[pk], scores[pk]
        )
    return out


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def _row(n: int, ep: int, season: dict, card: dict, friends: set[str]) -> dict:
    row = {
        "season": f"{SHOW}-{n}",
        "ep": ep,
        "week": season["episodes"][ep].get("week"),
        "key": card["key"],
        "style": card["style"],
        "song": card["song"],
        "dancers": [d for c in card["contestants"] for d in season["dancers"].get(c, [])],
        "locked": card["locked"],
    }
    if card["locked"]:
        return row
    values = [float(j["value"]) for j in card["judges"] if _confirmed(j)]
    theirs = [float(o["value"]) for o in card["others"] if o["sub"] in friends]
    return {
        **row,
        "judges": [
            {
                "id": j["id"],
                "value": None if j["value"] is None else float(j["value"]),
                "state": j["state"],
            }
            for j in card["judges"]
        ],
        # Only a whole confirmed panel makes a mean, as in common/accuracy.py.
        "panelMean": _mean(values) if len(values) == len(card["judges"]) else None,
        "mine": card["mine"],
        "friends": {"count": len(theirs), "mean": _mean(theirs)},
        "everyone": card["aggregate"],
    }


def _confirmed(judge: dict) -> bool:
    # A judge who sat a dance out is confirmed with no value (S20 week 9).
    return judge["state"] == "confirmed" and judge["value"] is not None


def _result(n: int, couple: str, season: dict, views: dict) -> dict:
    """How the couple's season went, once the caller has watched far enough to know."""
    c = next(c for c in season["contestants"] if cid(c) == couple)
    last = c.get("eliminatedEp")
    upto = [ep for ep in season["aired"] if last is None or ep <= last]
    left = [ep for ep in upto if not views[(n, ep)]["complete"]]
    if left:
        return {"locked": True, "season": f"{SHOW}-{n}", "ep": left[0]}
    if last is not None:
        return {"status": "out", "ep": last, "week": season["episodes"][last].get("week")}
    if not is_open(season["meta"]):
        return {"status": "dancing"}
    return {"status": "finalist"}


def _pooled(groups: list[dict]) -> dict:
    count = sum(g["count"] for g in groups)
    total = sum(float(g["mean"]) * g["count"] for g in groups if g["count"])
    return {"count": count, "mean": round(total / count, 2) if count else None}


def _dancer(rows: list[dict]) -> dict:
    """All-time numbers over the dances the caller has answered."""
    seen = [r for r in rows if not r["locked"]]
    judged = [r for r in seen if r["panelMean"] is not None]
    mine = [(r, float(r["mine"]["value"])) for r in seen if r["mine"] and "value" in r["mine"]]
    best = max(judged, key=lambda r: r["panelMean"], default=None)
    return {
        "dances": len(rows),
        "locked": len(rows) - len(seen),
        "judges": {"count": len(judged), "mean": _mean([r["panelMean"] for r in judged])},
        "best": best and {k: best[k] for k in ("season", "ep", "week", "style", "panelMean")},
        "mine": {
            "count": len(mine),
            "mean": _mean([v for _, v in mine]),
            "gap": _mean([v - r["panelMean"] for r, v in mine if r["panelMean"] is not None]),
        },
        "friends": _pooled([r["friends"] for r in seen]),
        "everyone": _pooled([r["everyone"] for r in seen]),
    }


def _judge(pid: str, rows: list[dict]) -> dict:
    """How a judge scores, over the dances the caller has answered and the judge has confirmed."""
    scored = []
    for r in rows:
        if r["locked"]:
            continue
        values = {j["id"]: j["value"] for j in r["judges"] if _confirmed(j)}
        if pid not in values:
            continue
        rest = [v for j, v in values.items() if j != pid]
        scored.append((r, values[pid], _mean(rest)))

    by_style, by_season = defaultdict(list), defaultdict(list)
    for r, v, _ in scored:
        by_style[r["style"] or "Unknown"].append(v)
        by_season[r["season"]].append(v)
    versus = sorted(
        ((v - rest, r, v) for r, v, rest in scored if rest is not None), key=lambda x: x[0]
    )
    mine = [
        (v, float(r["mine"]["value"])) for r, v, _ in scored if r["mine"] and "value" in r["mine"]
    ]

    def extreme(d: float, r: dict, v: float) -> dict:
        return {
            **{k: r[k] for k in ("season", "ep", "week", "style", "dancers")},
            "value": v,
            "vsPanel": round(d, 2),
        }

    return {
        "dances": len(rows),
        "locked": sum(r["locked"] for r in rows),
        "count": len(scored),
        "mean": _mean([v for _, v, _ in scored]),
        "panelMean": _mean([rest for _, _, rest in scored if rest is not None]),
        "vsPanel": _mean([d for d, _, _ in versus]),
        "harshest": [extreme(*x) for x in versus[:EXTREMES] if x[0] < 0],
        "generous": [extreme(*x) for x in versus[::-1][:EXTREMES] if x[0] > 0],
        "byStyle": sorted(
            ({"style": s, "count": len(vs), "mean": _mean(vs)} for s, vs in by_style.items()),
            key=lambda x: (-x["count"], x["style"]),
        ),
        "bySeason": [
            {"season": s, "count": len(vs), "mean": _mean(vs)} for s, vs in by_season.items()
        ],
        "distribution": {f"{v:g}": n for v, n in sorted(Counter(v for _, v, _ in scored).items())},
        "mine": {
            "count": len(mine),
            "gap": _mean([m - v for v, m in mine]),
            "mae": _mean([abs(m - v) for v, m in mine]),
        },
    }
