"""
Reads for one episode across armchair-catalog, -performances and -scores, and
the one write to -scores.

Nothing here decides visibility: callers pass what they read to common/gate.py.
"""

from __future__ import annotations

import re

from botocore.exceptions import ClientError

from lambdas.common.api import NotFoundError, ValidationError, require
from lambdas.common.dynamo import query_all, resource, table

SEASON = re.compile(r"([a-z]+)-(\d{1,3})")
EP = re.compile(r"\d{1,2}")


def season_ref(source: dict) -> tuple[str, int]:
    """(show, season) from `season=dwts-35` in a query string or body."""
    (season,) = require(source, "season")
    m = SEASON.fullmatch(str(season))
    if not m:
        raise ValidationError("season must look like dwts-35", field="season")
    return m[1], int(m[2])


def ref(source: dict) -> tuple[str, int, int]:
    """(show, season, ep) from `season=dwts-35` and `ep=05` in a query string or body."""
    show, season = season_ref(source)
    (ep,) = require(source, "ep")
    if type(ep) is int:
        ep = str(ep)
    if not isinstance(ep, str) or not EP.fullmatch(ep) or int(ep) == 0:
        raise ValidationError("ep must be an episode number like 05", field="ep")
    return show, season, int(ep)


def episode_pk(show: str, season: int, ep: int) -> str:
    return f"EP#{show}#{season}#{ep:02d}"


def catalog(show: str, season: int, ep: int) -> tuple[dict, dict, list[dict]]:
    """(META, the EP item, every CONTESTANT item) for one episode, from one Query."""
    rows = season_rows(show, season)
    by_sk = {r["sk"]: r for r in rows}
    episode = by_sk.get(f"EP#{ep:02d}")
    if "META" not in by_sk or episode is None:
        raise NotFoundError("No such episode", season=f"{show}-{season}", ep=ep)
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    return by_sk["META"], episode, contestants


def season_rows(show: str, season: int) -> list[dict]:
    return query_all(table("CATALOG_TABLE"), f"SEASON#{show}#{season}")


def performances(pk: str) -> list[dict]:
    return query_all(table("PERFORMANCES_TABLE"), pk)


def scores(pk: str) -> list[dict]:
    return query_all(table("SCORES_TABLE"), pk)


def create_score(item: dict, also: list[dict] | None = None) -> dict:
    """
    Writes the row unless one already exists, and returns whichever row is now
    stored. The caller compares it with what they sent; there is no overwrite.
    `also` are TransactWriteItems that land with the row or not at all.
    """
    tbl = table("SCORES_TABLE")
    put = {
        "Put": {
            "TableName": tbl.name,
            "Item": item,
            "ConditionExpression": "attribute_not_exists(sk)",
        }
    }
    try:
        resource().meta.client.transact_write_items(TransactItems=[put, *(also or [])])
        return item
    except ClientError as e:
        if e.response["Error"]["Code"] != "TransactionCanceledException":
            raise
    key = {"pk": item["pk"], "sk": item["sk"]}
    stored = tbl.get_item(Key=key, ConsistentRead=True).get("Item")
    if stored is None:
        # The row is absent, so something in `also` failed its condition.
        raise RuntimeError(f"score write for {item['sk']} cancelled with no row stored")
    return stored
