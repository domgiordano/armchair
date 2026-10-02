"""
Points for Traitors picks. Pure. The table and its edge cases are in
docs/features/traitors/PLAN.md, "Points" and "Events".
"""

from __future__ import annotations

BANISHED = 5
EXACT = {2: 3, 3: 2}
IN_TOP3 = 1
NIGHT = 4
WINNER, FACTION = 20, 10


def ranks(first_vote: dict[str, int]) -> dict[str, tuple[int, int]]:
    """
    Each player's span of ranks in the first vote. Equal counts share a span: in 5-2-2
    both twos hold ranks 2-3, so either is an exact pick for 2nd or 3rd.
    """
    counts = first_vote.values()
    return {
        p: (1 + sum(c > n for c in counts), sum(c >= n for c in counts))
        for p, n in first_vote.items()
    }


def round_table(picks: list[str], result: dict) -> int:
    """Slot 1 scores against who actually left; slots 2 and 3 against the first vote's ranks."""
    spans = ranks(result.get("firstVote") or {})
    total = 0
    for slot, p in enumerate(picks, start=1):
        lo, hi = spans.get(p, (99, 99))
        if slot == 1 and p == result.get("banished"):
            total += BANISHED
        elif slot > 1 and lo <= slot <= hi:
            total += EXACT[slot]
        elif lo <= 3:
            total += IN_TOP3
    return total


def night(pick: str, happened: list[str]) -> int:
    """MURDER against the victims, RECRUIT against the recruits. A night without one voids the pick."""
    return NIGHT if pick in happened else 0


def score(kind: str, picks: list[str], result: dict) -> int:
    if kind == "RT":
        return round_table(picks, result)
    return night(picks[0], result.get("victims" if kind == "MURDER" else "recruits") or [])


def multiplier(episodes: int, released: int) -> float:
    """A bet made before the premiere is worth everything; each episode out takes a share off."""
    return (episodes - released) / episodes if episodes else 0.0


def winner(bet: list[dict], winners: dict[str, str], episodes: int, released: int) -> int:
    """`winners` maps each winner's id to the faction they won as."""
    m = multiplier(episodes, released)
    total = 0.0
    for p in bet:
        if p["player"] in winners:
            total += WINNER * m
            if winners[p["player"]] == p["faction"]:
                total += FACTION * m
    return round(total)
