"""
How far each paddle landed from the judges: against the panel mean and against
each judge on that night's panel. Rules: docs/features/dwts-companion/PLAN.md,
"Accuracy (common/accuracy.py)".

Inputs are score rows that have already been through gate.visible_scores, so
nothing here can widen what a caller sees.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common.gate import perf_key, score_owner


def judged(perf: dict, panel: list[str]) -> dict[str, float] | None:
    """
    The panel's values for one performance, or None when it can't be scored
    against: not rateable, or any panel judge not yet confirmed. A team dance
    counts like any other: every member couple shares the one set of paddles.
    Bonus points live beside the judges, so they never reach this.
    """
    if perf.get("rateable") is False:
        return None
    judges = perf.get("judges") or {}
    if not panel or any((judges.get(j) or {}).get("state") != "confirmed" for j in panel):
        return None
    return {j: float(judges[j]["value"]) for j in panel}


def errors(panel: list[str], performances: list[dict], scores: list[dict]) -> dict[str, list]:
    """Per sub, one row per performance they paddled that the judges have confirmed."""
    values = {perf_key(p["sk"]): judged(p, panel) for p in performances}
    out = defaultdict(list)
    for row in scores:
        key, owner = score_owner(row)
        panel_values = values.get(key)
        if "value" not in row or panel_values is None:
            continue
        paddle = int(row["value"])
        mean = sum(panel_values.values()) / len(panel_values)
        out[owner].append(
            {
                "key": key,
                "paddle": paddle,
                "panelMean": round(mean, 2),
                "error": abs(paddle - mean),
                "judges": {j: abs(paddle - v) for j, v in panel_values.items()},
            }
        )
    return out


def summary(rows: list[dict]) -> dict:
    """Mean absolute error overall and per judge. A judge counts only the nights they sat."""
    per_judge = defaultdict(list)
    for r in rows:
        for j, e in r["judges"].items():
            per_judge[j].append(e)
    return {
        "count": len(rows),
        "mae": _mae([r["error"] for r in rows]),
        "judges": {j: {"count": len(es), "mae": _mae(es)} for j, es in per_judge.items()},
    }


def _mae(es: list[float]) -> float | None:
    return round(sum(es) / len(es), 2) if es else None
