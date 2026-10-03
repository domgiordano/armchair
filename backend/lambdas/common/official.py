"""The networks' cast pages: a short bio and a promo photo per player.

BBC Media Centre media packs (UK editions) and Peacock's cast posts (US) answer a plain
GET. US seasons 1 and 3, New Blood (NBC lists names only) and UK series 1 have no such
page (checked 2026-10-03); for those, and for any future season whose page breaks the
pattern, the fetch 404s and the other sources stand. One GET per season, from a cron or
a script only.
"""

from __future__ import annotations

import html
import json
import re
import urllib.request
from urllib.parse import urljoin

from lambdas.common.fandom import BIO_MAX, FACT, clip, scrub, variants
from lambdas.common.people import slug
from lambdas.common.traitors_parse import aliases, resolve
from lambdas.common.wiki_fetch import USER_AGENT

PAGES = {
    "tus": "https://www.peacocktv.com/blog/the-traitors-season-{n}-cast",
    "tuk": "https://www.bbc.co.uk/mediacentre/mediapacks/the-traitors-series-{n}-contestants",
    "tukc": "https://www.bbc.co.uk/mediacentre/mediapacks/the-celebrity-traitors-series-{n}-contestants-claudia-winkleman",
}
UNPATTERNED = {
    (
        "tukc",
        1,
    ): "https://www.bbc.co.uk/mediacentre/mediapacks/the-celebrity-traitors-contestants-claudia-winkleman",
}
# A player's entry starts at a heading, or a paragraph opening with their name in bold
# (Peacock's season 2 post). Only one naming a cast member counts.
HEAD = re.compile(
    r"<h[23][^>]*>(?P<h>.*?)</h[23]>|<p[^>]*>\s*<(?:strong|b)>(?P<p>[^<]{2,80})</(?:strong|b)>",
    re.DOTALL,
)
PARA = re.compile(r"<p[^>]*>(.*?)</p>", re.DOTALL)
SRCSET = re.compile(r'srcset="([^"]+)"')
IMG = re.compile(r'<img[^>]+src="([^"]+)"')


def url(show: str, number: int) -> str:
    return UNPATTERNED.get((show, number)) or PAGES[show].format(n=number)


def fetch(page: str) -> str | None:
    """The page's HTML, or None when it isn't there or won't answer: the season has no
    official source today."""
    req = urllib.request.Request(page, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", "replace")
    except OSError as e:
        print(json.dumps({"official": page, "error": repr(e)}))
        return None


def plain(fragment: str) -> str:
    out = html.unescape(re.sub(r"<[^>]+>", "", fragment)).replace("\xa0", " ")
    return " ".join(out.replace("“", '"').replace("”", '"').split())


def image(body: str, page: str) -> str | None:
    """The entry's first picture, at the largest size its srcset offers."""
    if m := SRCSET.search(body):
        return urljoin(page, m.group(1).split(",")[-1].split()[0])
    m = IMG.search(body)
    return m and urljoin(page, html.unescape(m.group(1)))


def entries(page: str, raw: str, names: list[str]) -> dict[str, dict]:
    """`{name: {paragraphs, image}}` for each cast member the page has an entry for. An
    entry runs to the next heading or the next bold line that reads like a name, which
    ends it even when it's someone the cast list spells differently."""
    short = aliases(names)
    # `Chris 'C.T.' Tamburello` is `Chris "CT" Tamburello`; `Maks Chmerkovskiy` is
    # `Maksim "Maks" Chmerkovskiy`.
    spelled = {slug(v): n for n in names for v in variants(n)}
    heads = []
    for m in HEAD.finditer(raw):
        heading = plain(m.group("h") if m.group("h") is not None else m.group("p"))
        heading = re.sub(r"\s*\(.*?\)", "", heading).strip()
        bare = re.sub(r"\s*'[^']+'\s*", " ", heading)
        who = resolve(short, heading) or spelled.get(slug(heading)) or spelled.get(slug(bare))
        name_like = len(heading.split()) <= 4 and not heading.endswith((".", ":", "?", "!"))
        if who or m.group("h") is not None or name_like:
            heads.append((m.start(), m.end(), who))
    out = {}
    for i, (_, end, who) in enumerate(heads):
        if who is None:
            continue
        body = raw[end : heads[i + 1][0] if i + 1 < len(heads) else len(raw)]
        out.setdefault(
            who,
            {
                "paragraphs": [p for p in map(plain, PARA.findall(body)) if p],
                "image": image(body, page),
            },
        )
    return out


def bio(paragraphs: list[str], page: str, running: bool) -> tuple[dict | None, bool]:
    """Facts (`Age: 34`) first, then the answers; questions dropped. Scrubbed while running."""
    facts = [p.rstrip(".") for p in paragraphs if FACT.match(p)]
    paras = [p for p in paragraphs if not FACT.match(p) and not p.endswith("?")]
    if facts:
        paras.insert(0, ". ".join(facts) + ".")
    cut = False
    if running:
        paras, cut = scrub(paras)
    body = clip(paras[:2], BIO_MAX)
    return (body and {"text": body, "source": "official", "sourceUrl": page}) or None, cut


def cast(show: str, number: int, names: list[str], running: bool) -> dict[str, dict]:
    """`{name: {bio, cut, image, sourceUrl}}` for the names the season's cast page has."""
    page = url(show, number)
    raw = fetch(page)
    if raw is None:
        return {}
    out = {}
    for who, entry in entries(page, raw, names).items():
        found, cut = bio(entry["paragraphs"], page, running)
        out[who] = {"bio": found, "cut": cut, "image": entry["image"], "sourceUrl": page}
    return out
