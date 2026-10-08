"""
One episode's dances and everyone's answers in a single item, so a stats read
is one Query per season instead of two per episode. In armchair-board:

    DIGEST#{show}#{season}  EP#{nn}  ep, week, theme, dances, answers

Only a settled episode is stored: its scoring window closed (or a past season)
and its results written. After that the poller stops processing it, so only
admin fixes (common/fixes.py) and account deletion (users_delete) change its
inputs, and both delete the item. Anything unsettled is built from the raw rows
on every read. Nothing here decides visibility: common/stats.py does, per viewer.
"""

from __future__ import annotations

from decimal import Decimal

from botocore.exceptions import ClientError

from lambdas.common import window
from lambdas.common.accuracy import judged
from lambdas.common.dynamo import query_all, query_many, table
from lambdas.common.episodes_dynamo import episode_pk
from lambdas.common.gate import is_open, perf_key, rateable, score_owner
from lambdas.common.logger import get_logger

log = get_logger(__file__)

# An answer row without a value: the dance was forfeited or skipped. It opens
# the dance to its owner like a paddle does, but scores nothing.
FORFEIT = 0


def digest_pk(show: str, season: int) -> str:
    return f"DIGEST#{show}#{season}"


def build(
    ep: int,
    meta: dict,
    episode: dict,
    contestants: list[dict],
    perfs: list[dict],
    scores: list[dict],
) -> dict:
    panel = episode.get("panel") or meta["defaultPanel"]
    by_key = {perf_key(p["sk"]): p for p in perfs}
    dances = []
    for key in rateable(ep, episode, contestants, perfs):
        perf = by_key.get(key, {})
        dances.append(
            {
                "key": key,
                "style": perf.get("style"),
                # A team dance's key names every member couple: "a+b+c#1".
                "couples": perf.get("contestants") or key.rsplit("#", 1)[0].split("+"),
                "judges": judged(perf, panel),
            }
        )
    answers: dict[str, dict[str, int]] = {}
    for row in scores:
        key, sub = score_owner(row)
        answers.setdefault(sub, {})[key] = int(row["value"]) if "value" in row else FORFEIT
    return {
        "ep": ep,
        "week": int(episode["week"]) if episode.get("week") is not None else None,
        "theme": episode.get("theme"),
        "dances": dances,
        "answers": answers,
    }


def settled(meta: dict, episode: dict, span: window.Span, at) -> bool:
    return is_open(meta) or (window.closed(meta, span, at) and episode.get("results") is not None)


def season(show: str, season: int, rows: list[dict]) -> list[dict]:
    """
    A digest per aired episode of the season, oldest first, from the cache where
    settled and the raw rows otherwise. `rows` is the season's catalog partition.
    """
    meta = next(r for r in rows if r["sk"] == "META")
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    episodes = {int(r["sk"].removeprefix("EP#")): r for r in rows if r["sk"].startswith("EP#")}
    spans = window.spans(meta, rows)
    at = window.now()
    aired = [
        n
        for n in sorted(episodes)
        if is_open(meta) or (spans[n][0] is not None and spans[n][0] <= at)
    ]
    tbl = table("BOARD_TABLE")
    cached = {int(r["sk"].removeprefix("EP#")): r for r in query_all(tbl, digest_pk(show, season))}
    missing = [n for n in aired if n not in cached]
    found = query_many(
        [
            (t, episode_pk(show, season, n))
            for n in missing
            for t in ("PERFORMANCES_TABLE", "SCORES_TABLE")
        ]
    )
    out = {n: _plain(cached[n]) for n in aired if n in cached}
    for i, n in enumerate(missing):
        d = build(n, meta, episodes[n], contestants, found[2 * i], found[2 * i + 1])
        out[n] = d
        if settled(meta, episodes[n], spans[n], at):
            _store(tbl, show, season, d)
    return [out[n] for n in aired]


def _store(tbl, show: str, season: int, d: dict) -> None:
    item = {"pk": digest_pk(show, season), "sk": f"EP#{d['ep']:02d}", **_decimal(d)}
    try:
        tbl.put_item(Item=item)
    except ClientError as e:
        # Past 400 KB of answers the cache can't hold the episode; reads build it every time.
        if e.response["Error"]["Code"] != "ValidationException":
            raise
        log.warning(f"digest {item['pk']} {item['sk']} not cached: {e}")


def forget(show: str, season: int, ep: int) -> None:
    table("BOARD_TABLE").delete_item(Key={"pk": digest_pk(show, season), "sk": f"EP#{ep:02d}"})


def _decimal(d: dict) -> dict:
    dances = [
        {
            **x,
            "judges": x["judges"] and {j: Decimal(str(v)) for j, v in x["judges"].items()},
        }
        for x in d["dances"]
    ]
    return {**d, "dances": dances}


def _plain(item: dict) -> dict:
    """A stored digest with DynamoDB's Decimals back to ints and floats."""
    return {
        "ep": int(item["ep"]),
        "week": int(item["week"]) if item.get("week") is not None else None,
        "theme": item.get("theme"),
        "dances": [
            {
                "key": x["key"],
                "style": x.get("style"),
                "couples": list(x["couples"]),
                "judges": x.get("judges") and {j: float(v) for j, v in x["judges"].items()},
            }
            for x in item["dances"]
        ],
        "answers": {s: {k: int(v) for k, v in a.items()} for s, a in item["answers"].items()},
    }
