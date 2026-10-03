"""Finishing places and look-alike celebrities for the person index seed_season writes.

Only finished seasons count: a current season's places would be results the
episode gate hasn't opened, so it has none, and nothing here reads its finish.
"""

from __future__ import annotations

import re

# The Result cell of a finalist's last dance. Early seasons put the third-placed
# couple out on finale night as "Eliminated (Third place)": elimination order covers it.
FINISH = {"winner": 1, "runner": 2, "third": 3, "fourth": 4, "fifth": 5}

# Matched against the bio's description, earliest word wins: "American actor & singer"
# is an actor. The occupations list is the fallback for a bare description.
CATEGORIES = {
    "Athlete": "player|gymnast|skater|swimmer|boxer|wrestler|fighter|athlete|sprinter|olympi"
    "|racing|driver|snowboarder|skier|jockey|golfer|quarterback|coach|cyclist|runner"
    "|volleyball|softball|bodybuilder",
    "Musician": "singer|rapper|musician|songwriter|band|guitarist|record producer"
    "|recording artist|pianist|composer|drummer|dj",
    "Comedian": "comedian",
    "TV host": "host|presenter|anchor|journalist|newscaster|meteorologist|weather|commentator"
    "|radio|broadcaster",
    "TV personality": "reality|television personality|tv personality|social media|influencer"
    "|youtuber|socialite|internet|chef|cook",
    "Actor": "actor|actress",
    "Model": "model",
}

SIMILAR = 6
# Finishes within this share of the field count as alike: 2nd and 3rd of 12, not 2nd and 8th.
CLOSE = 0.1


def places(season: dict) -> dict[str, int]:
    """Each couple's finishing place in a finished season: tied when two went out the same night."""
    if season["current"]:
        return {}
    cast = season["contestants"]
    out = {c["id"]: c["eliminatedEp"] for c in cast if c.get("eliminatedEp") is not None}
    place = {
        cid: 1 + sum(1 for c in cast if c.get("eliminatedEp") is None or c["eliminatedEp"] > ep)
        for cid, ep in out.items()
    }
    for e in season["episodes"]:
        for p in e.get("performances") or []:
            words = (p.get("result") or "").casefold()
            if len(p["contestants"]) != 1 or p["contestants"][0] in out:
                continue
            for word, n in FINISH.items():
                if word in words:
                    place[p["contestants"][0]] = n
    # A finalist whose Result cell is blank (S10, S13) took the place after the named ones.
    finalists = [c["id"] for c in cast if c.get("eliminatedEp") is None]
    named = [place[cid] for cid in finalists if cid in place]
    unnamed = [cid for cid in finalists if cid not in place]
    if named and len(unnamed) == 1:
        place[unnamed[0]] = len(finalists)
    return place


def category(bio: dict | None) -> str | None:
    if not bio:
        return None
    for text in (bio.get("description") or "", " ".join(bio.get("occupations") or [])):
        text = text.casefold()
        hits = [
            (m.start(), label)
            for label, words in CATEGORIES.items()
            if (m := re.search(rf"\b(?:{words})", text))
        ]
        if hits:
            return min(hits)[1]
    return None


def similar(celebs: dict[str, dict]) -> dict[str, list[dict]]:
    """
    Up to SIMILAR other celebrities per celebrity, most alike first: same field of
    work, the same season's cast, a finish in the same part of the field. `celebs`
    maps id to {name, headshot, category, seasons: {number: (place, cast size) or None}}.
    """

    def finish(c: dict) -> float | None:
        done = [v for _, v in sorted(c["seasons"].items()) if v]
        if not done:
            return None
        place, size = done[-1]
        return (place - 1) / max(size - 1, 1)

    finishes = {pid: finish(c) for pid, c in celebs.items()}
    out = {}
    for pid, me in celebs.items():
        scored = []
        for other, them in celebs.items():
            if other == pid:
                continue
            reasons = []
            if me["category"] and me["category"] == them["category"]:
                reasons.append("category")
            shared = set(me["seasons"]) & set(them["seasons"])
            if shared:
                reasons.append("cast")
            a, b = finishes[pid], finishes[other]
            if a is not None and b is not None and abs(a - b) <= CLOSE:
                reasons.append("finish")
            if not reasons:
                continue
            weight = {"category": 3, "cast": 2, "finish": 2}
            gap = min(abs(x - y) for x in me["seasons"] for y in them["seasons"])
            scored.append((-sum(weight[r] for r in reasons), gap, them["name"], other, reasons))
        out[pid] = [
            {
                "id": other,
                "name": celebs[other]["name"],
                "headshot": celebs[other]["headshot"],
                "season": max(celebs[other]["seasons"]),
                "category": celebs[other]["category"],
                "reasons": reasons,
            }
            for *_, other, reasons in sorted(scored)[:SIMILAR]
        ]
    return out
