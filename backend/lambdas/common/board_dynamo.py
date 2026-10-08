"""
armchair-board: leaderboard sums kept current on write, so a leaderboard read
is one Query of per-user rows and never touches a score.

Items:
    ERR#{show}#{season}#{nn}  {key}#USER#{sub}  sig, err, judges{jid: err}
    BOARD#{show}#{season}     USER#{sub}        n, err, J#{jid}#n, J#{jid}#err
    BOARD#{show}#all          USER#{sub}        the same, over every season

An ERR item is one dance counted: the user paddled a value and every panel
judge on it is confirmed. It is written in the same transaction as the change
to both BOARD rows, conditioned on what it replaces, so a dance enters the sums
exactly once whichever side completes it: scores_submit when the judges were
confirmed first, the poller's reconcile when the paddle came first. A judge
value Wikipedia corrects after confirming is swapped out by reconcile with the
difference applied.

Errors are stored rounded to 4 places as Decimal, so sums and their reversals
stay exact.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from botocore.exceptions import ClientError

from lambdas.common import window
from lambdas.common.accuracy import judged
from lambdas.common.dynamo import query_all, query_many, resource, table
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
    scores,
    season_index,
    season_rows,
)
from lambdas.common.gate import answered, perf_key, score_owner, sees

ALL = "all"
ATTEMPTS = 3


def err_pk(show: str, season: int, ep: int) -> str:
    return f"ERR#{show}#{season}#{ep:02d}"


def board_pk(show: str, season: int | str) -> str:
    return f"BOARD#{show}#{season}"


def _q(x: float) -> Decimal:
    return Decimal(str(round(x, 4)))


def contribution(panel_values: dict[str, float], paddle: int) -> dict:
    mean = sum(panel_values.values()) / len(panel_values)
    return {
        "sig": ",".join(f"{j}={v:g}" for j, v in sorted(panel_values.items())),
        "err": _q(abs(paddle - mean)),
        "judges": {j: _q(abs(paddle - v)) for j, v in panel_values.items()},
    }


def ops(sub: str, show: str, season: int, ep: int, changes: list[tuple]) -> list[dict]:
    """
    TransactWriteItems for one user's dances in one episode: each
    (key, old, new) ERR swap, then the net change to their season and all-time rows.
    """
    name = table("BOARD_TABLE").name
    delta: dict[str, Decimal] = defaultdict(Decimal)
    items = []
    for key, old, new in changes:
        ref = {"pk": err_pk(show, season, ep), "sk": f"{key}#USER#{sub}"}
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
            delta["n"] += sign
            delta["err"] += sign * c["err"]
            for j, e in c["judges"].items():
                delta[f"J#{j}#n"] += sign
                delta[f"J#{j}#err"] += sign * e

    names = {f"#a{i}": k for i, k in enumerate(delta)}
    for pk in (board_pk(show, season), board_pk(show, ALL)):
        items.append(
            {
                "Update": {
                    "TableName": name,
                    "Key": {"pk": pk, "sk": f"USER#{sub}"},
                    "UpdateExpression": "ADD " + ", ".join(f"{a} :d{a[2:]}" for a in names),
                    "ExpressionAttributeNames": names,
                    "ExpressionAttributeValues": {f":d{a[2:]}": delta[k] for a, k in names.items()},
                }
            }
        )
    return items


def transact(items: list[dict]) -> bool:
    """False when a condition fails: someone else changed an ERR item since it was read."""
    try:
        resource().meta.client.transact_write_items(TransactItems=items)
    except ClientError as e:
        if e.response["Error"]["Code"] != "TransactionCanceledException":
            raise
        return False
    return True


def wanted(panel: list[str], perfs: list[dict], score_rows: list[dict]) -> dict[str, dict]:
    """ERR items the episode should hold, by sk."""
    values = {perf_key(p["sk"]): judged(p, panel) for p in perfs}
    out = {}
    for row in score_rows:
        key, sub = score_owner(row)
        if "value" in row and values.get(key):
            out[f"{key}#USER#{sub}"] = contribution(values[key], int(row["value"]))
    return out


def reconcile(show: str, season: int, ep: int, panel: list[str]) -> int:
    """
    Brings one episode's ERR items, and everyone's sums with them, in line with
    its scores and confirmed judges. Returns how many dances changed.
    """
    pk = episode_pk(show, season, ep)
    for _ in range(ATTEMPTS):
        # ERR before scores: an ERR item read here has its score already
        # written, so a submit racing this is never taken for a stale dance.
        have = {r["sk"]: r for r in query_all(table("BOARD_TABLE"), err_pk(show, season, ep))}
        want = wanted(panel, performances(pk), scores(pk))
        by_user = defaultdict(list)
        for sk in have.keys() | want.keys():
            old, new = have.get(sk), want.get(sk)
            if old and new and old["sig"] == new["sig"]:
                continue
            key, _, sub = sk.partition("#USER#")
            by_user[sub].append((key, old, new))
        results = [transact(ops(sub, show, season, ep, c)) for sub, c in by_user.items()]
        if all(results):
            return sum(len(c) for c in by_user.values())
    # Failing the tick keeps META's revid unwritten, so the next tick runs this again.
    raise RuntimeError(f"board reconcile for {show}-{season} ep {ep} kept conflicting")


def rows(show: str, season: int | str, subs: set[str] | None = None) -> dict[str, dict]:
    """BOARD rows by sub: the whole partition, or only `subs`."""
    pk = board_pk(show, season)
    tbl = table("BOARD_TABLE")
    if subs is None:
        items = query_all(tbl, pk)
    else:
        keys = [{"pk": pk, "sk": f"USER#{s}"} for s in sorted(subs)]
        items = []
        for i in range(0, len(keys), 100):
            request = {tbl.name: {"Keys": keys[i : i + 100]}}
            while request:
                page = resource().batch_get_item(RequestItems=request)
                items += page["Responses"].get(tbl.name, [])
                request = page.get("UnprocessedKeys")
    return {r["sk"].removeprefix("USER#"): r for r in items}


def seasons_with(sub: str, show: str, seasons: list[int]) -> list[int]:
    """The seasons, of those given, where the caller has at least one dance counted."""
    tbl = table("BOARD_TABLE")
    keys = [{"pk": board_pk(show, s), "sk": f"USER#{sub}"} for s in seasons]
    found = set()
    for i in range(0, len(keys), 100):
        request = {tbl.name: {"Keys": keys[i : i + 100], "ProjectionExpression": "pk, n"}}
        while request:
            page = resource().batch_get_item(RequestItems=request)
            found |= {r["pk"] for r in page["Responses"].get(tbl.name, []) if r.get("n")}
            request = page.get("UnprocessedKeys")
    return [s for s in seasons if board_pk(show, s) in found]


def unseen(viewer: str, show: str, season: int, sealed: set[tuple[int, str]]) -> dict[str, dict]:
    """
    Per sub, the share of their BOARD sums from dances the viewer may not see
    (gate.sees): unanswered in an episode still taking answers, or `sealed`,
    locked in without revealing. A closed episode or a past season shows every
    dance, so it hides nothing but a seal. Read from the ERR items, which are
    per dance.
    """
    catalog = season_rows(show, season)
    meta = next((r for r in catalog if r["sk"] == "META"), None)
    if meta is None:
        return {}
    spans = window.spans(meta, catalog)
    at = window.now()
    eps = {n for n, span in spans.items() if not window.closed(meta, span, at)}
    eps |= {ep for ep, _ in sealed}
    eps = sorted(n for n in eps if n in spans)
    found = query_many(
        [
            pair
            for n in eps
            for pair in (
                ("BOARD_TABLE", err_pk(show, season, n)),
                ("SCORES_TABLE", episode_pk(show, season, n)),
            )
        ]
    )
    out: dict[str, dict] = defaultdict(lambda: defaultdict(Decimal))
    for i, n in enumerate(eps):
        errs, score_rows = found[2 * i], found[2 * i + 1]
        mine = answered(viewer, score_rows)
        opened = window.closed(meta, spans[n], at)
        for item in errs:
            key, _, sub = item["sk"].partition("#USER#")
            if sees(n, key, mine, opened, sealed):
                continue
            delta = out[sub]
            delta["n"] += 1
            delta["err"] += item["err"]
            for j, e in item["judges"].items():
                delta[f"J#{j}#n"] += 1
                delta[f"J#{j}#err"] += e
    return out


def seen_rows(
    viewer: str,
    show: str,
    season: int | str,
    sealed: set[tuple[int, str]],
    subs: set[str] | None = None,
) -> dict[str, dict]:
    """
    rows() less every dance the viewer may not see, in the show's current
    season: the one season anyone is still answering. `sealed` is that season's.
    """
    out = rows(show, season, subs)
    current = next((int(s["number"]) for s in season_index(show) if s.get("current")), None)
    if current is None or season not in (ALL, current):
        return out
    for sub, delta in unseen(viewer, show, current, sealed).items():
        if sub in out:
            out[sub] = {**out[sub], **{k: out[sub].get(k, 0) - v for k, v in delta.items()}}
    return out
