"""
Segment calls: a prediction on a night's marathon (who lasts longest) or
dance-off (who wins), made blind and final like a score. Optional, so they
never count toward an episode's rateable or answered.

They live in the scores table under their own partition, `SEG#{show}#{season}#{nn}`,
sk `{kind}#USER#{sub}`, so no reader of the episode's PERF# partition sees them.
What the caller may see of them is gate.episode_view's call.
"""

from __future__ import annotations

from lambdas.common.wiki_parse import MARATHON

MARATHON_KIND = "marathon"
DANCE_OFF = "dance-off"


def pk(show: str, season: int, ep: int) -> str:
    return f"SEG#{show}#{season}#{ep:02d}"


def sk(kind: str, sub: str) -> str:
    return f"{kind}#USER#{sub}"


def kinds(episode: dict) -> list[str]:
    """The calls a night takes, from the Dance chart's `format` line the poller writes."""
    line = episode.get("format") or ""
    out = [MARATHON_KIND] if MARATHON.search(line) else []
    return out + ([DANCE_OFF] if "dance-off" in line.lower() else [])


def couples(keys: list[str]) -> set[str]:
    """The couples dancing on their own that night, from gate.rateable's keys."""
    return {k.rsplit("#", 1)[0] for k in keys if "+" not in k}


def limit(kind: str, couples: int) -> int:
    """One couple outlasts the marathon; dance-offs pair couples up, so at most half win."""
    return 1 if kind == MARATHON_KIND else max(1, couples // 2)


def outcome(kind: str, picks: list[str], segments: list[dict]) -> dict | None:
    """How a call did against confirmed results.segments, or None before they're in."""
    if kind == DANCE_OFF:
        winners = {c for s in segments if _won(s) for c in s["contestants"]}
        if not winners:
            return None
        return {"hits": len(winners & set(picks)), "winners": len(winners)}

    rows = [s for s in segments if MARATHON.search(s["label"]) and s.get("points") is not None]
    if not rows:
        return None
    mine = next((s for s in rows if picks[0] in s["contestants"]), None)
    # Most points lasted longest; a tie shares the place.
    place = mine and 1 + sum(s["points"] > mine["points"] for s in rows)
    return {"place": place, "of": len(rows)}


def _won(row: dict) -> bool:
    if row["label"] != "Dance-off":
        return False
    # A winner's points are missing when the page never stated how many.
    return row.get("points") is not None or (row.get("text") or "").casefold().startswith("winner")
