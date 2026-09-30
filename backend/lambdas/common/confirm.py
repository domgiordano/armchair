"""
Provisional -> confirmed for judges' values read off Wikipedia. A value
confirms once it has been seen unchanged for WINDOW seconds; a changed value
starts over. Vandalism on the page is reverted in about two minutes (RESEARCH
Q1: a bogus 30 lasted 1m46s), so it never survives the window.

A judge entry is {value, state: provisional|confirmed, firstSeenAt (epoch s), rev}.
"""

from __future__ import annotations

from decimal import Decimal

WINDOW = 180


def step(prev: dict | None, value: Decimal, now: int, rev: int, window: int = WINDOW) -> dict:
    if prev is None or prev["value"] != value:
        prev = {"value": value, "state": "provisional", "firstSeenAt": now, "rev": rev}
    if prev["state"] == "provisional" and now - prev["firstSeenAt"] >= window:
        return {**prev, "state": "confirmed"}
    return prev


def judges(
    stored: dict,
    panel: list[str],
    values: list[Decimal] | None,
    now: int,
    rev: int,
    window: int = WINDOW,
) -> dict:
    """
    The performance's judges map after seeing `values` (one per panel seat, or
    None for an empty cell). An emptied cell drops provisional values, so a
    reverted vandal edit disappears; confirmed ones stay.
    """
    if values is None:
        return {j: e for j, e in stored.items() if e["state"] == "confirmed"}
    return {j: step(stored.get(j), v, now, rev, window) for j, v in zip(panel, values)}
