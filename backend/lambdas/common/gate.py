"""
The only code that decides what a caller may see of scores. Rules and their
reasons: docs/features/dwts-companion/PLAN.md, "Gating rule (server-side)".

A performance key is `{cid}#{n}`: the performances sk is `PERF#{key}` and the
scores sk is `PERF#{key}#USER#{sub}`. Inputs are raw DynamoDB items for one
episode; nothing here reads a table.
"""

from __future__ import annotations

from collections import defaultdict


def perf_key(sk: str) -> str:
    return sk.removeprefix("PERF#")


def score_owner(row: dict) -> tuple[str, str]:
    """(performance key, sub) of a scores row."""
    key, _, sub = perf_key(row["sk"]).partition("#USER#")
    return key, sub


def cid(contestant: dict) -> str:
    return contestant["sk"].removeprefix("CONTESTANT#")


def rateable(
    ep: int, episode: dict, contestants: list[dict], performances: list[dict]
) -> list[str]:
    """
    Keys the caller must answer before the episode's results open: every couple
    still in the competition that night times dancesPerCouple. Known before the
    poller writes anything; a performance marked unrateable (a team dance
    written before team dances were scored) drops out. An episode that lists
    its keys (`rateableKeys`) uses them: a two-night week, a dance-off or a
    withdrawal makes the roster count wrong. A scored team dance joins once the
    poller writes it, keyed by every member: `a+b+c#1`.
    """
    off = {perf_key(p["sk"]) for p in performances if p.get("rateable") is False}
    if episode.get("rateableKeys") is not None:
        keys = list(episode["rateableKeys"])
    else:
        dances = int(episode.get("dancesPerCouple") or 1)
        keys = [
            f"{cid(c)}#{n}"
            for c in contestants
            if c.get("eliminatedEp") is None or c["eliminatedEp"] >= ep
            for n in range(1, dances + 1)
        ]
    keys += [
        perf_key(p["sk"])
        for p in performances
        if p.get("rateable") is True
        and len(p.get("contestants") or []) > 1
        and perf_key(p["sk"]) not in keys
    ]
    return [k for k in keys if k not in off]


def answered(sub: str, scores: list[dict]) -> set[str]:
    """Keys the caller holds a row for, a value or a forfeit alike."""
    return {key for key, owner in map(score_owner, scores) if owner == sub}


def visible_scores(sub: str, scores: list[dict], members: set[str] | None = None) -> list[dict]:
    """
    Score rows the caller may see: only on performances they have answered, and
    only the caller's own plus `members` when a group is given. Every stat is
    computed over this and nothing wider.
    """
    done = answered(sub, scores)
    out = []
    for row in scores:
        key, owner = score_owner(row)
        if key not in done:
            continue
        if members is not None and owner != sub and owner not in members:
            continue
        out.append(row)
    return out


def episode_view(
    sub: str,
    ep: int,
    meta: dict,
    episode: dict,
    contestants: list[dict],
    performances: list[dict],
    scores: list[dict],
    members: set[str] | None = None,
) -> dict:
    """The whole episode as the caller may see it."""
    perfs = {perf_key(p["sk"]): p for p in performances}
    keys = rateable(ep, episode, contestants, performances)
    mine = {}
    for row in scores:
        key, owner = score_owner(row)
        if owner == sub:
            mine[key] = row
    # An empty roster means bad catalog data; keep results hidden rather than
    # letting all() of nothing reveal them.
    complete = bool(keys) and all(k in mine for k in keys)
    panel = episode.get("panel") or meta["defaultPanel"]

    values = defaultdict(list)
    for row in visible_scores(sub, scores, members):
        if "value" in row:
            key, owner = score_owner(row)
            values[key].append((owner, int(row["value"])))

    # An unrateable team dance has no answer of its own, so it opens with the episode.
    cards = [(k, k in mine) for k in keys]
    cards += [(k, complete) for k, p in perfs.items() if p.get("rateable") is False]

    view = {
        "ep": ep,
        "week": episode.get("week"),
        "airDate": episode.get("airDate"),
        "theme": episode.get("theme"),
        "panel": panel,
        "rateable": len(keys),
        "answered": sum(k in mine for k in keys),
        "complete": complete,
        "performances": [
            _card(key, perfs.get(key, {}), panel, mine.get(key), values[key], sub, complete)
            if revealed
            else _locked(key, perfs.get(key, {}))
            for key, revealed in _alphabetical(cards, contestants, perfs)
        ],
    }
    if complete:
        view["results"] = episode.get("results")
        view["eliminated"] = sorted(cid(c) for c in contestants if c.get("eliminatedEp") == ep)
    return view


def _alphabetical(cards: list, contestants: list[dict], perfs: dict) -> list:
    """
    By celebrity name, as the pre-show Wikipedia table lists them. Never the
    running order: where a card sits must not say whether it has aired.
    """
    names = {
        cid(c): next(m["name"] for m in c["members"] if m["role"] == "celebrity")
        for c in contestants
    }

    def sort_key(card):
        key = card[0]
        first = _contestants(key, perfs.get(key, {}))[0]
        return names.get(first, first).casefold(), _n(key)

    return sorted(cards, key=sort_key)


def _contestants(key: str, perf: dict) -> list[str]:
    return perf.get("contestants") or [key.rsplit("#", 1)[0]]


def _n(key: str) -> int:
    return int(key.rsplit("#", 1)[1])


def _locked(key: str, perf: dict) -> dict:
    return {
        "key": key,
        "contestants": _contestants(key, perf),
        "n": _n(key),
        "style": perf.get("style"),
        "song": perf.get("song"),
        "locked": True,
    }


def _card(
    key: str,
    perf: dict,
    panel: list[str],
    mine: dict | None,
    values: list[tuple[str, int]],
    sub: str,
    complete: bool,
) -> dict:
    judges = perf.get("judges") or {}
    card = {
        **_locked(key, perf),
        "locked": False,
        "judges": [
            {"id": j, "value": judges[j]["value"], "state": judges[j]["state"]}
            if j in judges
            else {"id": j, "value": None, "state": "pending"}
            for j in panel
        ],
        "mine": _answer(mine),
        "others": [{"sub": owner, "value": v} for owner, v in values if owner != sub],
        "aggregate": {
            "count": len(values),
            "mean": round(sum(v for _, v in values) / len(values), 2) if values else None,
        },
    }
    if complete:
        card["bonus"] = perf.get("bonus")
    return card


def _answer(row: dict | None) -> dict | None:
    if row is None:
        return None
    if row.get("forfeit"):
        return {"forfeit": True}
    return {"value": int(row["value"])}


def standing(row: dict | None) -> dict:
    """
    What a leaderboard shows of anyone: a count and means over the dances they
    scored, never a dance. Other users' numbers here cover their own answers,
    not the viewer's: docs/features/v2/PLAN.md "Leaderboards".
    """
    row = row or {}
    count = int(row.get("n") or 0)
    judges = {
        k.split("#")[1]: (int(row[k]), row[k.removesuffix("#n") + "#err"])
        for k in row
        if k.startswith("J#") and k.endswith("#n")
    }
    closest = min(
        ((float(e) / n, j) for j, (n, e) in judges.items() if n),
        default=None,
    )
    return {
        "count": count,
        "mae": round(float(row["err"]) / count, 2) if count else None,
        "closestJudge": closest and {"id": closest[1], "mae": round(closest[0], 2)},
    }
