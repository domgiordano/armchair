"""
Favorites to win: a snapshot per episode of who is likely to win a season, and the
one function that decides which snapshot a caller sees. Pure: no AWS.

Snapshot `n` is the board as of the end of episode `n` (0 is before the premiere). It
reads nothing from a later episode: performances, scores, picks and eliminations are
cut at `n`, and anything with a `submittedAt` at or after the next episode's start is
dropped. So snapshot `n` is the same whenever it is computed, apart from the market
price, which cron_favorites stops refreshing once episode `n + 1` starts.

A caller sees the snapshot for the last episode they have revealed (gate.results_open,
traitors_gate.seen), never a newer one. A couple out in an episode they haven't
revealed is still on that board, at its pre-elimination chance. Why, and the weights:
docs/features/favorites/PLAN.md.
"""

from __future__ import annotations

import math
from collections import defaultdict
from statistics import mean, pstdev

# Strength = sum of weight * z-score across the couples still in. A missing input
# (no crowd scores yet) contributes 0, the field's average.
DWTS_WEIGHTS = {"average": 1.0, "last": 0.5, "trend": 0.3, "crowd": 0.6}
# Survived a night in the judges' bottom two: the fan vote carried them.
SAVE_BONUS = 0.25
TRAITORS_WEIGHTS = {"backing": 1.0, "votes": -0.6, "suspected": -0.4}
SHIELD_BONUS = 0.2
# Softmax temperature: higher spreads the board further apart.
SHARPNESS = 1.2
# The market's share of a blended chance. Published odds win where a market exists;
# the model prices only who the market doesn't list, and the whole board without one.
MARKET_WEIGHT = 1.0
TREND_CHIP = 0.25
CHIPS = 3


def _z(values: dict[str, float | None]) -> dict[str, float]:
    known = [v for v in values.values() if v is not None]
    if len(known) < 2 or pstdev(known) == 0:
        return dict.fromkeys(values, 0.0)
    mu, sd = mean(known), pstdev(known)
    return {k: 0.0 if v is None else (v - mu) / sd for k, v in values.items()}


def _softmax(strength: dict[str, float]) -> dict[str, float]:
    top = max(strength.values())
    raw = {k: math.exp(SHARPNESS * (s - top)) for k, s in strength.items()}
    total = sum(raw.values())
    return {k: v / total for k, v in raw.items()}


def _slope(points: list[tuple[int, float]]) -> float | None:
    """Least-squares change per episode over the last three the couple danced."""
    points = points[-3:]
    if len(points) < 2:
        return None
    xs = [x for x, _ in points]
    mx, my = mean(xs), mean(y for _, y in points)
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in points) / den


def _rank(values: dict[str, float | None], reverse: bool = True) -> dict[str, int]:
    known = sorted((v, k) for k, v in values.items() if v is not None)
    if reverse:
        known.reverse()
    return {k: i + 1 for i, (_, k) in enumerate(known)}


def stamp(iso: str) -> str:
    """To the second, so "...+00:00" and "...Z" stamps compare as instants."""
    return iso[:19]


def _before(row: dict, cutoff: str | None) -> bool:
    return cutoff is None or stamp(row.get("submittedAt", "")) < stamp(cutoff)


def american(p: float) -> str:
    """A chance as American odds, rounded to 5: 0.22 is +355, 0.6 is -150."""
    p = min(max(p, 0.001), 0.999)
    if p >= 0.5:
        return f"-{round(100 * p / (1 - p) / 5) * 5}"
    return f"+{min(round(100 * (1 - p) / p / 5) * 5, 99900)}"


def dwts(
    n: int,
    contestants: list[dict],
    episodes: dict[int, tuple[list[dict], list[dict]]],
    cutoff: str | None,
) -> list[dict]:
    """
    Snapshot entries for DWTS episode `n`. `episodes` maps each episode up to `n` to its
    (performances, scores) rows; `cutoff` is the next episode's start as an ISO stamp,
    or None. Judge means count only dances with every judge confirmed; team dances,
    one score across several couples, are left out.
    """
    alive = [
        c["sk"].removeprefix("CONTESTANT#")
        for c in contestants
        if c.get("eliminatedEp") is None or int(c["eliminatedEp"]) > n
    ]
    out_on = {
        c["sk"].removeprefix("CONTESTANT#"): int(c["eliminatedEp"])
        for c in contestants
        if c.get("eliminatedEp") is not None and int(c["eliminatedEp"]) <= n
    }
    nightly: dict[str, list[tuple[int, float]]] = defaultdict(list)
    dances: dict[str, list[float]] = defaultdict(list)
    crowd: dict[str, list[int]] = defaultdict(list)
    saves: dict[str, int] = defaultdict(int)
    for ep in sorted(e for e in episodes if e <= n):
        perfs, scores = episodes[ep]
        night: dict[str, list[float]] = defaultdict(list)
        for p in perfs:
            judges = (p.get("judges") or {}).values()
            who = p.get("contestants") or []
            if len(who) != 1 or not judges or any(j["state"] != "confirmed" for j in judges):
                continue
            night[who[0]].append(float(mean(float(j["value"]) for j in judges)))
        for cid, values in night.items():
            dances[cid] += values
            nightly[cid].append((ep, mean(values)))
        for row in scores:
            key, _, _ = row["sk"].removeprefix("PERF#").partition("#USER#")
            cid = key.rsplit("#", 1)[0]
            if "value" in row and "+" not in cid and _before(row, cutoff):
                crowd[cid].append(int(row["value"]))
        if ep in out_on.values():
            totals = sorted((sum(v), cid) for cid, v in night.items())
            for _, cid in totals[:2]:
                if out_on.get(cid) != ep:
                    saves[cid] += 1

    inputs = {
        cid: {
            "average": round(mean(dances[cid]), 2) if dances[cid] else None,
            "last": round(nightly[cid][-1][1], 2) if nightly[cid] else None,
            "trend": None if (s := _slope(nightly[cid])) is None else round(s, 2),
            "crowd": round(mean(crowd[cid]), 2) if crowd[cid] else None,
            "saves": saves[cid],
        }
        for cid in alive
    }
    if not any(i["average"] is not None or i["crowd"] is not None for i in inputs.values()):
        return [{"id": cid, "model": None, "inputs": inputs[cid], "why": []} for cid in alive]

    zs = {k: _z({cid: inputs[cid][k] for cid in alive}) for k in DWTS_WEIGHTS}
    strength = {
        cid: sum(w * zs[k][cid] for k, w in DWTS_WEIGHTS.items())
        + SAVE_BONUS * inputs[cid]["saves"]
        for cid in alive
    }
    model = _softmax(strength)
    ranks = {k: _rank({cid: inputs[cid][k] for cid in alive}) for k in ("average", "last", "crowd")}
    return [
        {
            "id": cid,
            "model": round(model[cid], 4),
            "inputs": inputs[cid],
            "why": _dwts_why(inputs[cid], {k: r.get(cid) for k, r in ranks.items()}),
        }
        for cid in alive
    ]


def _dwts_why(i: dict, rank: dict) -> list[str]:
    chips = []
    if rank["average"] == 1:
        chips.append("Top judges' average")
    elif rank["average"] is not None and rank["average"] <= 3:
        chips.append("Top 3 judges' average")
    if rank["last"] == 1:
        chips.append("Top score last time")
    if i["trend"] is not None and i["trend"] >= TREND_CHIP:
        chips.append("Rising")
    elif i["trend"] is not None and i["trend"] <= -TREND_CHIP:
        chips.append("Slipping")
    if rank["crowd"] == 1:
        chips.append("Crowd favorite")
    if i["saves"]:
        chips.append("Saved from the bottom two" + (f" x{i['saves']}" if i["saves"] > 1 else ""))
    return chips


def traitors(
    n: int,
    players: list[dict],
    episodes: dict[int, tuple[list[dict], list[dict]]],
    bets: list[dict],
    cutoff: str | None,
) -> list[dict]:
    """
    Snapshot entries for Traitors episode `n`. `episodes` maps each episode up to `n`
    to its (performances, scores) rows, `bets` are the season's winner bets. Factions
    are never read: a current season hides who the Traitors are until a banishment the
    caller has seen, so the board can't lean on it either.
    """
    alive = [
        p["sk"].removeprefix("PLAYER#")
        for p in players
        if not p.get("exit") or int(p["exit"]["ep"]) > n
    ]
    backing: dict[str, float] = defaultdict(float)
    for b in bets:
        if not _before(b, cutoff):
            continue
        named = [p["player"] for p in b.get("picks") or [] if p["player"] in alive]
        for pid in named:
            backing[pid] += 1 / len(named)
    votes: dict[str, float] = defaultdict(float)
    shields: dict[str, int] = defaultdict(int)
    last_votes: dict[str, int] = {}
    suspected: dict[str, float] = {}
    for ep in sorted(e for e in episodes if e <= n):
        results, picks = episodes[ep]
        rows = {r["sk"].removeprefix("EVT#"): r for r in results if r.get("state") == "confirmed"}
        if "RT" in rows:
            first = rows["RT"].get("firstVote") or {}
            # The last two round tables count double: suspicion is recent.
            weight = 2 if ep > n - 2 else 1
            for pid, count in first.items():
                votes[pid] += weight * int(count)
            last_votes = {pid: int(c) for pid, c in first.items()}
        for pid in (rows.get("SHIELD") or {}).get("shields") or []:
            shields[pid] += 1
        rt = [
            r["picks"]
            for r in picks
            if r["sk"].startswith("EVT#RT#") and r.get("picks") and _before(r, cutoff)
        ]
        if rt:
            counts: dict[str, int] = defaultdict(int)
            for chosen in rt:
                for pid in chosen:
                    counts[pid] += 1
            suspected = {pid: c / len(rt) for pid, c in counts.items()}

    inputs = {
        pid: {
            "backing": round(backing[pid], 2),
            "votes": round(votes[pid], 2),
            "lastVotes": last_votes.get(pid, 0),
            "suspected": round(suspected.get(pid, 0.0), 2),
            "shields": shields[pid],
        }
        for pid in alive
    }
    if not any(backing.values()) and not any(votes.values()) and not suspected:
        return [{"id": pid, "model": None, "inputs": inputs[pid], "why": []} for pid in alive]

    zs = {k: _z({pid: inputs[pid][k] for pid in alive}) for k in TRAITORS_WEIGHTS}
    strength = {
        pid: sum(w * zs[k][pid] for k, w in TRAITORS_WEIGHTS.items())
        + SHIELD_BONUS * inputs[pid]["shields"]
        for pid in alive
    }
    model = _softmax(strength)
    top_backed = _rank({pid: inputs[pid]["backing"] or None for pid in alive})
    top_suspected = _rank({pid: inputs[pid]["suspected"] or None for pid in alive})
    return [
        {
            "id": pid,
            "model": round(model[pid], 4),
            "inputs": inputs[pid],
            "why": _traitors_why(
                inputs[pid], top_backed.get(pid), top_suspected.get(pid), bool(votes)
            ),
        }
        for pid in alive
    ]


def _traitors_why(i: dict, backed: int | None, suspected: int | None, voted: bool) -> list[str]:
    chips = []
    if backed == 1:
        chips.append("Crowd's top winner pick")
    elif backed is not None and backed <= 3:
        chips.append("Popular winner pick")
    if voted and i["votes"] == 0:
        chips.append("No votes against yet")
    if i["lastVotes"]:
        chips.append(f"{i['lastVotes']} vote{'s' if i['lastVotes'] != 1 else ''} last round table")
    if suspected == 1:
        chips.append("Most suspected")
    if i["shields"]:
        chips.append("Has held a shield")
    return chips


def blend(entries: list[dict], market: dict[str, float] | None) -> dict[str, float]:
    """
    Each entry's chance: the model and the market, MARKET_WEIGHT to the market. The
    market is renormalized over the entries, so a couple out in an earlier episode,
    priced near zero, doesn't take a share. An entry the market doesn't list keeps its
    model chance on both sides. Either source alone stands alone; neither is uniform.
    """
    ids = [e["id"] for e in entries]
    model = {e["id"]: e["model"] for e in entries if e["model"] is not None}
    priced = {i: float(market[i]) for i in ids if market and market.get(i) is not None}
    if priced and sum(priced.values()) > 0:
        total = sum(priced.values())
        priced = {i: p / total for i, p in priced.items()}
    else:
        priced = {}
    if not model and not priced:
        return {}
    if not model:
        return {i: priced.get(i, 0.0) for i in ids}
    if not priced:
        return {i: model.get(i, 0.0) for i in ids}
    # Unpriced entries keep their model share of the market side too.
    covered = sum(model.get(i, 0.0) for i in priced)
    side = {i: priced[i] * covered if i in priced else model.get(i, 0.0) for i in ids}
    mixed = {i: (1 - MARKET_WEIGHT) * model.get(i, 0.0) + MARKET_WEIGHT * side[i] for i in ids}
    total = sum(mixed.values())
    return {i: p / total for i, p in mixed.items()}


def pick(snapshots: dict[int, dict], revealed: int) -> int | None:
    """The newest snapshot at or before the caller's last revealed episode."""
    return max((n for n in snapshots if n <= revealed), default=None)


def for_viewer(
    snapshots: dict[int, dict], revealed: int, latest: int, next_start: dict[int, str | None]
) -> dict:
    """
    The board a caller may see: the snapshot for their last revealed episode, with
    movement against the one before it. `latest` is the newest episode out, `next_start`
    maps an episode to the ISO start of the one after it. A market price captured at or
    after the next episode started could already know who went out in it, so it is
    dropped, whatever snapshot it sits in; cron_favorites shouldn't have stored one.
    """
    n = pick(snapshots, revealed)
    if n is None:
        return {
            "asOf": None,
            "latest": latest,
            "behind": latest > revealed,
            "entries": [],
            "market": None,
        }
    snap = snapshots[n]
    market = _safe_market(snap.get("market"), next_start.get(n))
    chances = blend(snap["entries"], market and market["prices"])
    before = max((k for k in snapshots if k < n), default=None)
    moved = {}
    if before is not None:
        old = snapshots[before]
        old_market = _safe_market(old.get("market"), next_start.get(before))
        moved = blend(old["entries"], old_market and old_market["prices"])
    order = sorted(snap["entries"], key=lambda e: (-chances.get(e["id"], 0.0), e["id"]))
    old_order = {
        i: r + 1 for r, (i, _) in enumerate(sorted(moved.items(), key=lambda kv: (-kv[1], kv[0])))
    }
    entries = []
    for rank, e in enumerate(order, 1):
        p = chances.get(e["id"])
        entries.append(
            {
                "id": e["id"],
                "rank": rank,
                "chance": None if p is None else round(p, 4),
                "odds": None if p is None else american(p),
                "model": e["model"],
                "market": market and market["prices"].get(e["id"]),
                "inputs": e["inputs"],
                "why": (
                    (["Market favorite"] if market and _top(market, e["id"], chances) else [])
                    + e["why"]
                )[:CHIPS],
                "move": (
                    {"rank": old_order[e["id"]] - rank, "chance": round(p - moved[e["id"]], 4)}
                    if p is not None and e["id"] in moved
                    else None
                ),
            }
        )
    return {
        "asOf": n,
        "latest": latest,
        "behind": latest > n,
        "computedAt": snap.get("computedAt"),
        "source": "market" if market else "model",
        "entries": entries if chances else [],
        "market": market and {k: market[k] for k in ("source", "url", "capturedAt")},
    }


def _safe_market(market: dict | None, next_start: str | None) -> dict | None:
    if not market or (next_start is not None and stamp(market["capturedAt"]) >= stamp(next_start)):
        return None
    return market


def _top(market: dict, pid: str, chances: dict) -> bool:
    prices = {i: p for i, p in market["prices"].items() if i in chances and p is not None}
    return bool(prices) and max(prices, key=prices.get) == pid
