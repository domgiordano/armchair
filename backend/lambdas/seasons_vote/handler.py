"""
GET /seasons/vote - the air schedule and every couple's SMS keyword, for the vote panel.

Every couple is listed, eliminated or not. Who went home is gated per caller
(PLAN.md "Gating rule"), and dropping them from this list would give it away.
The episode screen narrows it with the gated state.
"""

from __future__ import annotations

from boto3.dynamodb.conditions import Key

from lambdas.common.api import api_handler, ok
from lambdas.common.catalog import SEASON_PK
from lambdas.common.dynamo import table


def member(row: dict, role: str) -> str:
    return next(m["name"] for m in row["members"] if m["role"] == role)


@api_handler("seasons_vote")
def handler(event, context):
    rows = table("CATALOG_TABLE").query(KeyConditionExpression=Key("pk").eq(SEASON_PK))["Items"]
    meta = next(r for r in rows if r["sk"] == "META")
    episodes = [
        {
            "ep": int(r["sk"].removeprefix("EP#")),
            "airDate": r["airDate"],
            "start": r["start"],
            "end": r["end"],
        }
        for r in rows
        if r["sk"].startswith("EP#")
    ]
    couples = [
        {
            "cid": r["sk"].removeprefix("CONTESTANT#"),
            "celebrity": member(r, "celebrity"),
            "pro": member(r, "pro"),
            "keyword": r.get("keywordOverride") or r["keyword"],
        }
        for r in rows
        if r["sk"].startswith("CONTESTANT#")
    ]
    couples.sort(key=lambda c: c["celebrity"].casefold())
    return ok({"timezone": meta["timezone"], "episodes": episodes, "couples": couples})
