"""Seasons seeded as current or past, for tests of the past-season rule (gate.is_open)."""

from scripts.seed_season import items, write
from tests.conftest import CATALOG_TABLE


def as_current(season: dict) -> dict:
    """A finished season replayed as the current one, each night aired at 8pm, so it's gated."""
    episodes = [{**e, "start": e.get("start") or "20:00"} for e in season["episodes"]]
    return {**season, "current": True, "episodes": episodes}


def close(db, season: dict) -> None:
    """The re-seed that moves a season off current."""
    write(db.Table(CATALOG_TABLE), items({**season, "current": False}))
