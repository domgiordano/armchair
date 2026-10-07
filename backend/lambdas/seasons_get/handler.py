"""
GET /seasons/get?season=dwts-35 - schedule, roster, judges and headshot credits.

Built field by field from the catalog, never by passing items through:
eliminatedEp and results are gated per episode (common/gate.py), so they reach
a caller only via /episodes/state. `open` is gate.is_open: a past season,
view-only and ungated. Each episode carries its scoring `window` {opensAt,
closesAt, open} (common/window.py); `activeEpisode` is the one taking answers
now with the caller's progress on it, or null between seasons.
"""

from __future__ import annotations

from lambdas.common import window
from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import season_ref, season_rows
from lambdas.common.gate import is_open


def _pick(item: dict, *fields: str) -> dict:
    return {f: item.get(f) for f in fields}


@api_handler("seasons_get")
def handler(event, context):
    sub = caller_sub(event)
    show, season = season_ref(query(event))
    rows = season_rows(show, season)
    meta = next((r for r in rows if r["sk"] == "META"), None)
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{season}")

    def kind(prefix: str) -> list[tuple[str, dict]]:
        return [(r["sk"].removeprefix(prefix), r) for r in rows if r["sk"].startswith(prefix)]

    spans = window.spans(meta, rows)
    now = window.now()
    live = window.active(meta, spans, now)
    current = None
    if live is not None:
        episode = next(r for r in rows if r["sk"] == f"EP#{live:02d}")
        contestants = [r for _, r in kind("CONTESTANT#")]
        current = window.progress(sub, show, season, live, episode, contestants, spans[live])

    return ok(
        {
            "season": f"{show}-{season}",
            "open": is_open(meta),
            "timezone": meta["timezone"],
            "episodes": [
                {
                    "ep": int(ep),
                    **_pick(e, "week", "airDate", "start", "end", "theme"),
                    "window": window.view(meta, spans[int(ep)], now),
                }
                for ep, e in kind("EP#")
            ],
            "activeEpisode": current,
            "judges": [{"id": jid, **_pick(j, "name", "headshot")} for jid, j in kind("JUDGE#")],
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
