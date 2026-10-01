"""
Per-couple numbers for the Couples screens (performers_get, week_board_get).

Built only from gate.visible_scores, and narrowed further to the performances
the caller paddled a value on, so a dance they skipped or haven't answered
never counts for them or for anyone else. Other people reach the caller only
as a mean over at least MIN_RATERS of them.
"""

from __future__ import annotations

from collections import defaultdict

from lambdas.common.accuracy import judged
from lambdas.common.api import ForbiddenError
from lambdas.common.gate import perf_key, score_owner, visible_scores
from lambdas.common.groups_dynamo import members
from lambdas.common.social_dynamo import peers, status

# One other person's "average" is just their paddle.
MIN_RATERS = 2


def friends(sub: str) -> set[str]:
    return {s for s, item in peers(sub).items() if status(item) == "friend"}


def group_pool(sub: str, gid: str) -> set[str]:
    in_group = members(gid)
    # A group that doesn't exist answers the same, so a guess learns nothing.
    if sub not in in_group:
        raise ForbiddenError("Not a member of that group")
    return in_group


def dances(
    sub: str,
    episode: dict,
    panel: list[str],
    perfs: list[dict],
    score_rows: list[dict],
    pool: set[str] | None = None,
) -> list[dict]:
    """
    One row per performance the caller paddled: their value, the panel's mean
    and total (None until every judge is confirmed), and the other values the
    gate lets them see, by sub. Team dances are left out: one paddle shared by
    several couples says nothing about any one of them.
    """
    by_key = {perf_key(p["sk"]): p for p in perfs}
    mine: dict[str, int] = {}
    others: dict[str, dict[str, int]] = defaultdict(dict)
    for row in visible_scores(sub, score_rows, pool):
        if "value" not in row:
            continue
        key, owner = score_owner(row)
        if owner == sub:
            mine[key] = int(row["value"])
        else:
            others[key][owner] = int(row["value"])

    out = []
    for key, paddle in mine.items():
        perf = by_key.get(key, {})
        couple = key.rsplit("#", 1)[0]
        if "+" in couple or len(perf.get("contestants") or [couple]) > 1:
            continue
        values = judged(perf, panel)
        out.append(
            {
                "ep": int(episode["sk"].removeprefix("EP#")),
                "week": episode.get("week"),
                "key": key,
                "couple": couple,
                "style": perf.get("style"),
                "paddle": paddle,
                "judges": round(sum(values.values()) / len(values), 2) if values else None,
                "total": sum(values.values()) if values else None,
                "others": others[key],
            }
        )
    return out


def mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def summary(rows: list[dict]) -> dict:
    """The caller against the judges over some dances. Gaps are paddle minus panel mean."""
    scored = [d for d in rows if d["judges"] is not None]
    gaps = [d["paddle"] - d["judges"] for d in scored]
    return {
        "dances": len(rows),
        "you": mean([d["paddle"] for d in rows]),
        "judges": mean([d["judges"] for d in scored]),
        "judged": len(scored),
        "gap": mean(gaps),
        "absGap": mean([abs(g) for g in gaps]),
    }


def crowd(rows: list[dict], subs: set[str] | None = None) -> dict:
    """Other people's mean over these dances, or None when fewer than MIN_RATERS paddled."""
    values = [v for d in rows for s, v in d["others"].items() if subs is None or s in subs]
    raters = {s for d in rows for s in d["others"] if subs is None or s in subs}
    return {"mean": mean(values) if len(raters) >= MIN_RATERS else None, "raters": len(raters)}


def people(roster: list[dict]) -> list[dict]:
    return [{k: m.get(k) for k in ("name", "role", "headshot")} for m in roster]
