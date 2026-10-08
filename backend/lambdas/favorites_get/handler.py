"""
GET /favorites/get?season=dwts-35[&through=5] - who is favored to win, as of the last
episode the caller has revealed: every DWTS dance answered or the episode closed
(gate.results_open), every Traitors event picked or the episode closed
(traitors_gate.seen). Episodes count in order, so one unfinished episode holds the
board at the one before it, however many have aired since. `through` lowers that
further, for dances the caller has answered but sealed on their device; it never
raises it. Which snapshot, and why: common/favorites.py.

    {season, show, revealed, asOf, latest, behind, computedAt, model,
     market: {source, url, capturedAt} | null,
     episodes: [{ep, week}],                     DWTS only, to name asOf and the next one
     entries: [{id, rank, chance, odds, model, market, inputs, why, move,
                name, partner, headshot}]}
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import window
from lambdas.common.api import NotFoundError, ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_ref, season_rows
from lambdas.common.favorites import for_viewer
from lambdas.common.favorites_dynamo import latest, next_starts, snapshots, starts
from lambdas.common.gate import cid, is_open, results_open
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_gate import card, ep_number, seen

MODEL = {
    "dwts": "Judges' scores, survival and our crowd's scores",
    "traitors": "Our crowd's winner picks, round table votes and shields",
}


def now() -> datetime:
    return datetime.now(UTC)


def _dwts_revealed(
    sub: str, show: str, number: int, meta: dict, rows: list[dict], newest: int
) -> int:
    if is_open(meta):
        return newest
    at = now()
    spans = window.spans(meta, rows)
    by_sk = {r["sk"]: r for r in rows}
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    live = [n for n in range(1, newest + 1) if not window.closed(meta, spans[n], at)]
    found = query_many(
        [
            (t, episode_pk(show, number, n))
            for n in live
            for t in ("PERFORMANCES_TABLE", "SCORES_TABLE")
        ]
    )
    reads = {n: (found[2 * i], found[2 * i + 1]) for i, n in enumerate(live)}
    for n in range(1, newest + 1):
        if n in reads and not results_open(
            sub, n, meta, by_sk[f"EP#{n:02d}"], contestants, *reads[n]
        ):
            return n - 1
    return newest


def _traitors_revealed(
    sub: str, show: str, number: int, meta: dict, rows: list[dict], newest: int
) -> int:
    episodes = sorted(
        (r for r in rows if r["sk"].startswith("EP#") and ep_number(r) <= newest), key=ep_number
    )
    picks = query_many([("SCORES_TABLE", episode_pk(show, number, ep_number(e))) for e in episodes])
    for e, answers in zip(episodes, picks):
        if not seen(sub, meta, e, answers):
            return ep_number(e) - 1
    return newest


def _people(show: str, rows: list[dict]) -> dict[str, dict]:
    if show == "dwts":
        out = {}
        for r in rows:
            if not r["sk"].startswith("CONTESTANT#"):
                continue
            by_role = {m["role"]: m for m in r["members"]}
            star, pro = by_role.get("celebrity", {}), by_role.get("pro", {})
            out[cid(r)] = {
                "name": star.get("name"),
                "partner": pro.get("name"),
                "headshot": star.get("headshot"),
            }
        return out
    return {
        c["id"]: {"name": c["name"], "partner": None, "headshot": c["headshot"]}
        for c in map(card, (r for r in rows if r["sk"].startswith("PLAYER#")))
    }


@api_handler("favorites_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, number = season_ref(params)
    if show != "dwts" and show not in EDITIONS:
        raise ValidationError("No favorites for that show", field="season")
    through = params.get("through")
    if through is not None and not str(through).isdigit():
        raise ValidationError("through must be an episode number", field="through")
    rows = season_rows(show, number)
    meta = next((r for r in rows if r["sk"] == "META"), None)
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{number}")

    start = starts(show, meta, rows)
    newest = latest(start, now().strftime("%Y-%m-%dT%H:%M:%SZ"))
    reveal = _dwts_revealed if show == "dwts" else _traitors_revealed
    revealed = reveal(sub, show, number, meta, rows, newest)
    if through is not None:
        revealed = min(revealed, int(through))

    view = for_viewer(snapshots(show, number), revealed, newest, next_starts(start))
    people = _people(show, rows)
    data = {
        "season": f"{show}-{number}",
        "show": show,
        "revealed": revealed,
        "model": MODEL["dwts" if show == "dwts" else "traitors"],
        **view,
        "entries": [{**e, **people.get(e["id"], {})} for e in view["entries"]],
    }
    if show == "dwts":
        data["episodes"] = [
            {"ep": int(r["sk"].removeprefix("EP#")), "week": r.get("week")}
            for r in sorted(rows, key=lambda r: r["sk"])
            if r["sk"].startswith("EP#")
        ]
    return ok(data)
