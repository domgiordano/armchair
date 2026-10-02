"""One MediaWiki API call for a page's latest revision, by page id.

By id because titles move: New Blood has an open move request, and a redirect left in
its place would fetch the redirect (docs/features/traitors/RESEARCH.md Q3).
"""

from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "armchair/0.1 (https://github.com/domgiordano/armchair)"


def latest(pageid: int) -> dict:
    """`{revid, timestamp, content, title}` for the page's current revision."""
    query = urlencode(
        {
            "action": "query",
            "prop": "revisions",
            "pageids": pageid,
            "rvprop": "ids|timestamp|content",
            "rvslots": "main",
            "format": "json",
            "formatversion": "2",
        }
    )
    req = Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=10) as resp:
        page = json.load(resp)["query"]["pages"][0]
    rev = page["revisions"][0]
    return {
        "revid": rev["revid"],
        "timestamp": rev["timestamp"],
        "content": rev["slots"]["main"]["content"],
        "title": page["title"],
    }
