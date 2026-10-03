"""MediaWiki API calls: a page's latest revision, titles resolved to page ids, and article leads.

Season pages are fetched by id because titles move: New Blood has an open move request,
and a redirect left in its place would fetch the redirect (docs/features/traitors/RESEARCH.md Q3).
"""

from __future__ import annotations

import json
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

API = "https://en.wikipedia.org/w/api.php"
ARTICLE = "https://en.wikipedia.org/wiki/"
USER_AGENT = "armchair/0.1 (https://github.com/domgiordano/armchair)"
# TextExtracts returns at most 20 intros per call.
EXLIMIT = 20
INTRO = {"prop": "extracts", "exintro": 1, "explaintext": 1, "exlimit": EXLIMIT}


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


def targets(found: dict, titles: list[str]) -> dict[str, str]:
    """Each asked title mapped to the page it lands on, through normalizing and any redirect."""
    normalized = {n["from"]: n["to"] for n in found.get("normalized", [])}
    redirects = {r["from"]: r["to"] for r in found.get("redirects", [])}
    out = {}
    for title in titles:
        to = normalized.get(title, title)
        out[title] = redirects.get(to, to)
    return out


def pageids(titles: list[str]) -> dict[str, dict]:
    """`{title: {pageid, title}}` through any redirect. Missing pages are left out. At most 50 titles."""
    found = query({"titles": "|".join(titles), "redirects": 1})
    pages = {p["title"]: p["pageid"] for p in found["pages"] if "missing" not in p}
    return {
        title: {"pageid": pages[to], "title": to}
        for title, to in targets(found, titles).items()
        if to in pages
    }


def lead(page: dict) -> dict | None:
    """An article's lead as plain text, with its URL for the CC BY-SA attribution."""
    text = (page.get("extract") or "").strip()
    if not text:
        return None
    return {"text": text, "sourceUrl": url(page["title"])}


def url(title: str) -> str:
    return ARTICLE + quote(title.replace(" ", "_"), safe="/:(),")


def summary(pageid: int) -> dict | None:
    """A season article's lead: `{text, sourceUrl}`, or None when it has none."""
    return lead(query({**INTRO, "pageids": pageid})["pages"][0])


def leads(titles: list[str]) -> dict[str, dict | None]:
    """Each article's lead keyed by the title asked for, EXLIMIT titles per call."""
    out: dict[str, dict | None] = {}
    for i in range(0, len(titles), EXLIMIT):
        chunk = titles[i : i + EXLIMIT]
        found = query({**INTRO, "titles": "|".join(chunk), "redirects": 1})
        pages = {p["title"]: lead(p) for p in found["pages"] if "missing" not in p}
        out |= {title: pages.get(to) for title, to in targets(found, chunk).items()}
    return out
