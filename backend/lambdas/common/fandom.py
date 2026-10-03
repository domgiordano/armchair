"""Fandom wiki reads: players' pages for bios, episode pages for recaps, as plain text.

Only api.php answers; the HTML pages sit behind a Cloudflare challenge (RESEARCH Q4).
Content is CC BY-SA, attributed by each result's `sourceUrl`. Calls are spaced GAP
seconds apart and capped per Lambda run by `allow`, and never run in an API request.
"""

from __future__ import annotations

import json
import re
import time
import urllib.request
from urllib.parse import quote, urlencode

from lambdas.common.people import slug
from lambdas.common.traitors_parse import text
from lambdas.common.wiki_fetch import USER_AGENT, targets

# thetraitors.fandom.com covers the US and international editions.
WIKI = {
    "tus": "https://thetraitors.fandom.com",
    "tuk": "https://thetraitorsuk.fandom.com",
    "tukc": "https://thetraitorsuk.fandom.com",
}
# Only the UK wiki has episode pages; the US wiki has none (checked 2026-10-03).
EPISODE = {
    "tuk": "Series {season}, Episode {ep}",
    "tukc": "Series {season}, Episode {ep} (Celebrity)",
}
GAP = 1.0
BATCH = 50
BIO_MAX, RECAP_MAX = 900, 1500
BIO_SECTIONS = ("biography", "about", "profile", "background", "early life")
NOT_RECAP = re.compile(r"trivia|gallery|references?|notes|see also|external links", re.IGNORECASE)
# Anything that could say how a player's season went. A sentence with one is dropped.
SPOILER = re.compile(
    r"banish|murder|eliminat|\bwon\b(?!['’]t)|winner|runner|finalist|traitor|faithful"
    r"|recruit|seer|shield|\bplac(?:ed|ing)\b|\bquit",
    re.IGNORECASE,
)
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'“‘])")
FACT = re.compile(r"^[A-Z][\w' -]{1,25}:\s*\S.{0,100}$")
EDITION = re.compile(r"\{\{\s*(?:V\d?|wp)\s*\|\s*([^{}|]*)\}\}", re.IGNORECASE)
MEDIA = re.compile(
    r"\[\[(?:File|Image|Category):[^\[\]]*(?:\[\[[^\]]*\]\][^\[\]]*)*\]\]", re.IGNORECASE
)
TABLE = re.compile(r"^\{\|.*?^\|\}", re.DOTALL | re.MULTILINE)
HEADING = re.compile(r"^(=+)\s*(.*?)\s*\1$")

_last = 0.0
# A Lambda caps its run with `allow`; a script runs uncapped.
_left: float = float("inf")


def allow(calls: int) -> None:
    """Sets how many calls this run may make."""
    global _left
    _left = calls


def get(show: str, params: dict) -> dict | None:
    """One api.php call. None when the run's allowance is spent or the call fails: the
    caller keeps what it has and the next run asks again."""
    global _last, _left
    if _left <= 0:
        return None
    _left -= 1
    wait = _last + GAP - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    url = f"{WIKI[show]}/api.php?" + urlencode({**params, "format": "json", "formatversion": 2})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.load(resp)
    except OSError as e:
        print(json.dumps({"fandom": url, "error": repr(e)}))
        return None
    finally:
        _last = time.monotonic()


def url(show: str, title: str) -> str:
    return f"{WIKI[show]}/wiki/" + quote(title.replace(" ", "_"), safe="/:(),")


def pages(show: str, titles: list[str]) -> dict[str, dict]:
    """`{asked title: {title, url, content, image}}` for the titles with a page, through redirects."""
    out = {}
    for i in range(0, len(titles), BATCH):
        chunk = titles[i : i + BATCH]
        found = get(
            show,
            {
                "action": "query",
                "prop": "revisions|pageimages",
                "titles": "|".join(chunk),
                "rvprop": "content",
                "rvslots": "main",
                "piprop": "name",
                "redirects": 1,
            },
        )
        if found is None:
            break
        q = found.get("query", {})
        have = {
            p["title"]: {
                "title": p["title"],
                "url": url(show, p["title"]),
                "content": p["revisions"][0]["slots"]["main"]["content"],
                "image": p.get("pageimage"),
            }
            for p in q.get("pages", [])
            if p.get("revisions")
        }
        out |= {asked: have[to] for asked, to in targets(q, chunk).items() if to in have}
    return out


def variants(name: str) -> list[str]:
    """The name as the wiki may title it: as given, without a nickname, and by the
    nickname (`Yamil "Yam Yam" Arocho` is `Yam Yam Arocho`)."""
    nick = re.search(r'"([^"]+)"', name)
    out = [name, plain(name)] + ([f"{nick.group(1)} {name.split()[-1]}"] if nick else [])
    return list(dict.fromkeys(out))


def plain(name: str) -> str:
    return re.sub(r'\s*"[^"]+"\s*', " ", name).strip()


def hits(show: str, query: str) -> list[str]:
    found = get(show, {"action": "query", "list": "search", "srsearch": query, "srlimit": 5})
    return [h["title"] for h in (found or {}).get("query", {}).get("search", [])]


def search(show: str, name: str) -> str | None:
    """A search hit that is the player, a `(disambiguator)` aside: one titled with a
    variant of the name, else a surname search's hit with their first name or nickname,
    for a page under a married name or a shortened surname."""
    names = variants(name)
    whole = {slug(v) for v in names}
    firsts = {slug(v.split()[0]) for v in names}

    def bare(title: str) -> str:
        return slug(re.sub(r"\s*\(.*\)$", "", title))

    if title := next((t for t in hits(show, plain(name)) if bare(t) in whole), None):
        return title
    found = hits(show, name.split()[-1])
    return next((t for t in found if bare(t) in whole), None) or next(
        (t for t in found if bare(t).split("-")[0] in firsts), None
    )


def players(show: str, names: list[str]) -> dict[str, dict]:
    """Each name's page: one titled with a variant of it, else a search hit (`search`)."""
    titled = pages(show, sorted({v for n in names for v in variants(n)}))
    found = {
        n: next(titled[v] for v in variants(n) if v in titled)
        for n in names
        if any(v in titled for v in variants(n))
    }
    hit = {n: t for n in names if n not in found and (t := search(show, n))}
    by_title = pages(show, sorted(set(hit.values())))
    return found | {n: by_title[t] for n, t in hit.items() if t in by_title}


def sections(wikitext: str, title: str) -> dict[str, list[str]]:
    """Plain-text paragraphs under each heading, lowercased; the lead is under ''."""
    raw = wikitext.replace("{{PAGENAME}}", title)
    raw = TABLE.sub("", MEDIA.sub("", EDITION.sub(r"\1", raw)))
    out: dict[str, list[str]] = {"": []}
    under = ""
    for line in text(raw).split("\n"):
        line = re.sub(r"^[*#:;]+\s*", "", line).strip()
        if m := HEADING.match(line):
            under = m.group(2).lower()
            out.setdefault(under, [])
        # A Q&A profile's questions and "Retrieved from ...:" lines aren't prose.
        elif line and not line.endswith(("?", ":")) and not line.startswith(("{|", "|", "!")):
            out[under].append(line)
    return out


def clip(paragraphs: list[str], limit: int) -> str:
    """Whole sentences, paragraph breaks kept, up to `limit` characters."""
    out, size = [], 0
    for para in paragraphs:
        kept = []
        for sentence in SENTENCE.split(para):
            size += len(sentence) + 1
            if size > limit:
                break
            kept.append(sentence)
        if kept:
            out.append(" ".join(kept))
        if size > limit:
            break
    return "\n\n".join(out)


def scrub(paragraphs: list[str]) -> tuple[list[str], bool]:
    """Drops every sentence that could tell how a season went. True when one was dropped."""
    out, cut = [], False
    for para in paragraphs:
        kept = [s for s in SENTENCE.split(para) if not SPOILER.search(s)]
        cut |= len(kept) < len(SENTENCE.split(para))
        if kept:
            out.append(" ".join(kept))
    return out, cut


def bio(page: dict, running: bool) -> tuple[dict | None, bool]:
    """A player's intro, profile facts and profile, at most two paragraphs. For a season
    still running, scrubbed of spoilers. Returns (bio, whether a sentence was scrubbed)."""
    parts = sections(page["content"], page["title"])
    lines = parts[""] + next((parts[s] for s in BIO_SECTIONS if parts.get(s)), [])
    facts = [p.rstrip(".") for p in lines if FACT.match(p)]
    paras = [p for p in lines if not FACT.match(p)]
    if facts:
        paras.insert(min(1, len(paras)), ". ".join(facts) + ".")
    cut = False
    if running:
        paras, cut = scrub(paras)
    body = clip(paras[:2], BIO_MAX)
    return (body and {"text": body, "source": "fandom", "sourceUrl": page["url"]}) or None, cut


def recap(page: dict) -> dict | None:
    """An episode page's prose, its boilerplate lead and trivia aside."""
    parts = sections(page["content"], page["title"])
    paras = [p for head, ps in parts.items() if head and not NOT_RECAP.search(head) for p in ps]
    body = clip(paras, RECAP_MAX)
    return (body and {"text": body, "source": "fandom", "sourceUrl": page["url"]}) or None


def recaps(show: str, season: int, eps: list[int]) -> dict[int, dict]:
    """Recaps from the wiki's episode pages, for the editions that have them."""
    pattern = EPISODE.get(show)
    if not pattern or not eps:
        return {}
    titles = {pattern.format(season=season, ep=ep): ep for ep in eps}
    return {titles[t]: r for t, page in pages(show, list(titles)).items() if (r := recap(page))}


def bios(show: str, names: list[str], running: bool) -> dict[str, tuple[dict | None, bool]]:
    """`{name: (bio, cut)}` for the names with a page; see `bio`."""
    return {n: bio(page, running) for n, page in players(show, names).items()}
