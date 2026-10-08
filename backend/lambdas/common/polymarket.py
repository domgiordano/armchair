"""
Winner prices from Polymarket's public Gamma API: no key, one GET per season per run.
Polymarket asks that a quoted price cite the market page and when it was read, so a
snapshot keeps both (docs/features/favorites/PLAN.md, "Sources").
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import UTC, datetime
from urllib.request import Request, urlopen

API = "https://gamma-api.polymarket.com/events?slug="
PAGE = "https://polymarket.com/event/"
USER_AGENT = "armchair/0.1 (https://github.com/domgiordano/armchair)"

# The season's winner market, by event slug. A season without one has no market price.
MARKETS = {("dwts", 35): "who-will-win-dancing-with-the-stars-season-35"}


def fold(name: str) -> str:
    """ "Harry Shum Jr." and "Harry Shum Jr" are one name."""
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", ascii_.lower()).strip()


def prices(event: dict, names: dict[str, str]) -> dict[str, float]:
    """The Yes price of each listed market whose title is one of `names` (folded name -> id)."""
    out = {}
    for m in event.get("markets") or []:
        cid = names.get(fold(m.get("groupItemTitle") or ""))
        if cid is None or not m.get("outcomePrices"):
            continue
        out[cid] = float(json.loads(m["outcomePrices"])[0])
    return out


def market(show: str, season: int, names: dict[str, str], at: datetime) -> dict | None:
    """{source, url, capturedAt, prices} for the season, or None when it has no market."""
    slug = MARKETS.get((show, season))
    if slug is None:
        return None
    req = Request(API + slug, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=10) as resp:
        events = json.load(resp)
    if not events:
        return None
    found = prices(events[0], names)
    if not found:
        return None
    return {
        "source": "Polymarket",
        "url": PAGE + slug,
        "capturedAt": at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "prices": found,
    }
