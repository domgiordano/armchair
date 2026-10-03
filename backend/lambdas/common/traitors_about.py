"""Episode recaps and player bios for a Traitors season: Wikipedia first, then Fandom, then
(bios only) the network's cast page.

A recap is `{text, source: "wikipedia"|"fandom", sourceUrl}` on the catalog EP item; it
reveals results, so traitors_gate decides who sees it. A bio has the same shape, source
also "official", on the PLAYER item. Each source is asked only for what the ones before
it lack, and for a finished season only once; whatever none can answer keeps what the
catalog already holds.
"""

from __future__ import annotations

from lambdas.common import fandom, official
from lambdas.common.wiki_fetch import url as article_url


def recaps(
    show: str,
    number: int,
    title: str,
    parsed: dict,
    have: dict[int, dict | None],
    ask: set[int],
) -> dict[int, dict | None]:
    """Each episode's recap: its ShortSummary on the season article, else its Fandom page
    for the episodes in `ask`, else what `have` holds."""
    url = article_url(title) + "#Episodes"
    out: dict[int, dict | None] = {
        e["n"]: {"text": e["summary"], "source": "wikipedia", "sourceUrl": url}
        for e in parsed["episodes"]
        if e["summary"]
    }
    found = fandom.recaps(show, number, sorted(ask - set(out)))
    for e in parsed["episodes"]:
        n = e["n"]
        out[n] = out.get(n) or found.get(n) or have.get(n)
    return out


def bios(
    show: str,
    number: int,
    cast: list[dict],
    leads: dict[str, dict | None],
    have: dict[str, dict],
    running: bool,
) -> dict[str, tuple[dict | None, bool]]:
    """
    `{name: (bio, cut)}` for every contestant: the lead of their Wikipedia article, else
    the intro of their Fandom page, else their entry on the network's cast page
    (common/official.py). `have` is the season's PLAYER items by name.

    While the season runs, a Fandom or network bio is scrubbed of anything that could
    say how it went (fandom.scrub) and refetched daily; `cut` says something was
    scrubbed, so the first run after the finale fetches it whole. A finished season's
    is fetched once.
    """
    out: dict[str, tuple[dict | None, bool]] = {}
    for p in cast:
        lead = leads.get(p["article"] or "")
        if lead:
            out[p["name"]] = {**lead, "source": "wikipedia"}, False
    ask = [
        p["name"]
        for p in cast
        if p["name"] not in out
        and (running or not have.get(p["name"], {}).get("bio") or have[p["name"]].get("bioCut"))
    ]
    found = {n: hit for n, hit in fandom.bios(show, ask, running).items() if hit[0]}
    rest = [n for n in ask if n not in found]
    if rest:
        site = official.cast(show, number, rest, running)
        found |= {n: (e["bio"], e["cut"]) for n, e in site.items() if e["bio"]}
    for p in cast:
        name = p["name"]
        stored = have.get(name, {})
        out.setdefault(name, found.get(name) or (stored.get("bio"), bool(stored.get("bioCut"))))
    return out
