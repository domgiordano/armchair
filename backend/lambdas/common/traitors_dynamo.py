"""Reads for a Traitors season. Nothing here decides visibility: see common/traitors_gate.py."""

from __future__ import annotations

from lambdas.common.api import NotFoundError, ValidationError
from lambdas.common.dynamo import table
from lambdas.common.episodes_dynamo import season_ref
from lambdas.common.traitors_catalog import EDITIONS


def traitors_ref(source: dict) -> tuple[str, int]:
    show, number = season_ref(source)
    if show not in EDITIONS:
        raise ValidationError("Not a Traitors season", field="season")
    return show, number


def season_parts(rows: list[dict], show: str, number: int) -> tuple[dict, list[dict], list[dict]]:
    """(META, EP items in order, PLAYER items) from one catalog partition."""
    meta = next((r for r in rows if r["sk"] == "META"), None)
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{number}")
    episodes = sorted((r for r in rows if r["sk"].startswith("EP#")), key=lambda r: r["sk"])
    players = [r for r in rows if r["sk"].startswith("PLAYER#")]
    return meta, episodes, players


def episode(episodes: list[dict], ep: int, show: str, number: int) -> dict:
    found = next((e for e in episodes if e["sk"] == f"EP#{ep:02d}"), None)
    if found is None:
        raise NotFoundError("No such episode", season=f"{show}-{number}", ep=ep)
    return found


def bet_key(show: str, number: int, sub: str) -> dict:
    return {"pk": f"WIN#{show}#{number}", "sk": f"USER#{sub}"}


def bet(show: str, number: int, sub: str) -> dict | None:
    return table("SCORES_TABLE").get_item(Key=bet_key(show, number, sub)).get("Item")
