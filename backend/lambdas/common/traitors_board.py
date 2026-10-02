"""
Traitors points in armchair-board, kept current when a result is confirmed, so a
leaderboard read never touches a pick. Same shape and reasoning as board_dynamo.py.

Items:
    PTS#{show}#{season}#{nn}   {type}#USER#{sub}   sig, pts, hit
    PTS#{show}#{season}#WIN    WIN#USER#{sub}      sig, pts
    BOARD#{show}#{season}      USER#{sub}          pts, events, banishHits
    BOARD#{show}#all           USER#{sub}          the same, over every season

A PTS item is one pick scored. It is written with the change to both BOARD rows in
one transaction, conditioned on the item it replaces, so a pick counts exactly once.
`sig` is the result it was scored against: a correction on Wikipedia after confirming
swaps the item and applies the difference. Forfeits score nothing and aren't counted.
"""

from __future__ import annotations

import json
from collections import defaultdict

from lambdas.common import points
from lambdas.common.board_dynamo import ALL, ATTEMPTS, board_pk, transact
from lambdas.common.dynamo import query_all, table
from lambdas.common.episodes_dynamo import episode_pk, performances, scores
from lambdas.common.traitors_gate import pick_owner, result


def pts_pk(show: str, season: int, ep: int | str) -> str:
    return f"PTS#{show}#{season}#{ep if isinstance(ep, str) else f'{ep:02d}'}"


def sig(value) -> str:
    return json.dumps(value, sort_keys=True, default=str)


def ops(sub: str, show: str, season: int, pk: str, changes: list[tuple]) -> list[dict]:
    """TransactWriteItems for one user: each (sk, old, new) PTS swap, then the net change to both BOARD rows."""
    name = table("BOARD_TABLE").name
    delta: dict[str, int] = defaultdict(int)
    items = []
    for sk, old, new in changes:
        ref = {"pk": pk, "sk": sk}
        if old is None:
            cond = {"ConditionExpression": "attribute_not_exists(sk)"}
        else:
            cond = {
                "ConditionExpression": "sig = :sig",
                "ExpressionAttributeValues": {":sig": old["sig"]},
            }
        if new is None:
            items.append({"Delete": {"TableName": name, "Key": ref, **cond}})
        else:
            items.append({"Put": {"TableName": name, "Item": {**ref, **new}, **cond}})
        for sign, c in ((1, new), (-1, old)):
            if c is None:
                continue
            delta["pts"] += sign * int(c["pts"])
            if "hit" in c:
                delta["events"] += sign
                delta["banishHits"] += sign * int(bool(c["hit"]))

    names = {f"#a{i}": k for i, k in enumerate(delta)}
    for board in (board_pk(show, season), board_pk(show, ALL)):
        items.append(
            {
                "Update": {
                    "TableName": name,
                    "Key": {"pk": board, "sk": f"USER#{sub}"},
                    "UpdateExpression": "ADD " + ", ".join(f"{a} :d{a[2:]}" for a in names),
                    "ExpressionAttributeNames": names,
                    "ExpressionAttributeValues": {f":d{a[2:]}": delta[k] for a, k in names.items()},
                }
            }
        )
    return items


def wanted(results: list[dict], picks: list[dict]) -> dict[str, dict]:
    """PTS items one episode should hold, by sk: every pick whose event has a confirmed result."""
    settled = {r["sk"].removeprefix("EVT#"): result(r) for r in results}
    out = {}
    for row in picks:
        kind, sub = pick_owner(row)
        res = settled.get(kind)
        if res is None or not row.get("picks"):
            continue
        out[f"{kind}#USER#{sub}"] = {
            "sig": sig(res),
            "pts": points.score(kind, list(row["picks"]), res),
            "hit": kind == "RT" and row["picks"][0] == res.get("banished"),
        }
    return out


def settle(show: str, season: int, pk: str, want: dict[str, dict]) -> int:
    """Brings one PTS partition, and everyone's sums with it, in line with `want`. Returns how many changed."""
    for _ in range(ATTEMPTS):
        have = {r["sk"]: r for r in query_all(table("BOARD_TABLE"), pk)}
        by_user = defaultdict(list)
        for sk in have.keys() | want.keys():
            old, new = have.get(sk), want.get(sk)
            if old and new and old["sig"] == new["sig"]:
                continue
            by_user[sk.partition("#USER#")[2]].append((sk, old, new))
        if all(transact(ops(sub, show, season, pk, c)) for sub, c in by_user.items()):
            return sum(len(c) for c in by_user.values())
    raise RuntimeError(f"traitors board for {pk} kept conflicting")


def reconcile(show: str, season: int, ep: int) -> int:
    pk = episode_pk(show, season, ep)
    return settle(show, season, pts_pk(show, season, ep), wanted(performances(pk), scores(pk)))


def reconcile_winners(show: str, season: int, winners: dict[str, str], episodes: int) -> int:
    """Scores every winner bet once the season's winners are known: `winners` maps id to faction."""
    bets = query_all(table("SCORES_TABLE"), f"WIN#{show}#{season}")
    want = {
        f"WIN#{b['sk']}": {
            "sig": sig(winners),
            "pts": points.winner(b["picks"], winners, episodes, int(b["released"])),
        }
        for b in bets
    }
    return settle(show, season, pts_pk(show, season, "WIN"), want)
