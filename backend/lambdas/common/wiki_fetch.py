"""MediaWiki API calls: a page's latest revision, and titles resolved to page ids.

Season pages are fetched by id because titles move: New Blood has an open move request,
and a redirect left in its place would fetch the redirect (docs/features/traitors/RESEARCH.md Q3).
"""

from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "armchair/0.1 (https://github.com/domgiordano/armchair)"


def query(params: dict) -> dict:
    params = {"action": "query", **params, "format": "json", "formatversion": "2"}
    req = Request(f"{API}?{urlencode(params)}", headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=10) as resp:
        return json.load(resp)["query"]


def latest(page: int | str) -> dict:
    """`{revid, timestamp, content, title}` for the current revision, by page id or by title."""
    by = {"pageids": page} if isinstance(page, int) else {"titles": page, "redirects": 1}
    found = query({"prop": "revisions", **by, "rvprop": "ids|timestamp|content", "rvslots": "main"})
    hit = found["pages"][0]
    rev = hit["revisions"][0]
    return {
        "revid": rev["revid"],
        "timestamp": rev["timestamp"],
        "content": rev["slots"]["main"]["content"],
        "title": hit["title"],
    }


def pageids(titles: list[str]) -> dict[str, dict]:
    """`{title: {pageid, title}}` through any redirect. Missing pages are left out. At most 50 titles."""
    found = query({"titles": "|".join(titles), "redirects": 1})
    normalized = {n["from"]: n["to"] for n in found.get("normalized", [])}
    redirects = {r["from"]: r["to"] for r in found.get("redirects", [])}
    pages = {p["title"]: p["pageid"] for p in found["pages"] if "missing" not in p}
    out = {}
    for title in titles:
        to = normalized.get(title, title)
        to = redirects.get(to, to)
        if to in pages:
            out[title] = {"pageid": pages[to], "title": to}
    return out
