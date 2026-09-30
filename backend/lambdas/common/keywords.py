"""SMS vote keywords, derived from celebrity names. Rule: PLAN.md "SMS keyword derivation"."""

from __future__ import annotations

from collections import Counter

SUFFIXES = {"jr", "sr", "ii", "iii"}


def keywords(celebs: dict[str, str], overrides: dict[str, str] | None = None) -> dict[str, str]:
    """Keyword per contestant id, given every celebrity's full name that season.

    First name, or first name plus last initial when another celebrity shares the first
    name. Spelling variants (Conner/Connor) don't clash; they need an override.
    """
    firsts = Counter(name.split()[0].casefold() for name in celebs.values())
    out = {}
    for cid, name in celebs.items():
        first, *rest = name.split()
        if firsts[first.casefold()] > 1:
            last = [w for w in rest if w.rstrip(".,").casefold() not in SUFFIXES][-1]
            first = f"{first} {last[0]}"
        out[cid] = first
    return out | (overrides or {})
