"""
GET /seasons/get?season=dwts-35 - schedule, roster, judges and headshot credits.

Built field by field from the catalog, never by passing items through:
eliminatedEp and results are gated per episode (common/gate.py), so they reach
a caller only via /episodes/state. `open` is gate.is_open: a past season,
view-only and ungated.
"""

from __future__ import annotations

from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import season_ref, season_rows
from lambdas.common.gate import is_open
from lambdas.common.guest_judges import seat


def _pick(item: dict, *fields: str) -> dict:
    return {f: item.get(f) for f in fields}


@api_handler("seasons_get")
def handler(event, context):
    caller_sub(event)
    show, season = season_ref(query(event))
    rows = season_rows(show, season)
    meta = next((r for r in rows if r["sk"] == "META"), None)
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{season}")

    def kind(prefix: str) -> list[tuple[str, dict]]:
        return [(r["sk"].removeprefix(prefix), r) for r in rows if r["sk"].startswith(prefix)]

    episodes = [e for _, e in kind("EP#")]

    return ok(
        {
            "season": f"{show}-{season}",
            "open": is_open(meta),
            "timezone": meta["timezone"],
            "episodes": [
                {"ep": int(ep), **_pick(e, "week", "airDate", "start", "end", "theme")}
                for ep, e in kind("EP#")
            ],
            "judges": [
                {
                    "id": jid,
                    **_pick(j, "name", "headshot"),
                    **seat(jid, meta["defaultPanel"], episodes),
                }
                for jid, j in kind("JUDGE#")
            ],
            "contestants": [
                {
                    "id": cid,
                    "keyword": c.get("keywordOverride") or c.get("keyword"),
                    "members": [_pick(m, "name", "role", "headshot") for m in c["members"]],
                }
                for cid, c in kind("CONTESTANT#")
            ],
        }
    )
