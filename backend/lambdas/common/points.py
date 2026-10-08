"""
Points for Traitors picks. Pure. The table and its edge cases are in
docs/features/traitors/PLAN.md, "Points" and "Events".
"""

from __future__ import annotations

from fractions import Fraction

BANISHED = 5
EXACT = {2: 3, 3: 2}
IN_TOP3 = 1
NIGHT = 4
WINNER, FACTION = 20, 10
# A winner bet is ranked: a right 2nd choice earns 60% of a right 1st, a 3rd 30%.
RANK_SHARE = (Fraction(1), Fraction(3, 5), Fraction(3, 10))


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


def winner(bet: list[dict], winners: dict[str, str], episodes: int) -> int:
    """
    `bet` is the ranked picks, each with the `released` count it was sealed at. A slot
    sealed before the premiere is worth everything; each episode out by then takes a
    share off, (episodes - released) / episodes. `winners` maps each winner's id
    to the faction they won as; joint winners each score their own slot.
    """
    if not episodes:
        return 0
    # Exact, then half up, so a slot worth 13.5 is 14 here and in the app's Math.round.
    total = Fraction(0)
    for share, p in zip(RANK_SHARE, bet):
        if p["player"] not in winners:
            continue
        m = share * Fraction(episodes - int(p["released"]), episodes)
        total += WINNER * m
        if winners[p["player"]] == p["faction"]:
            total += FACTION * m
    return int(total + Fraction(1, 2))
