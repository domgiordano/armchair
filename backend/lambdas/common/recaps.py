"""
Published recaps of one episode, for the AI write-ups (common/writeups.py).

Articles are found two ways: the citations in the episode's `=== Week N` section
of the Wikipedia season page, where editors cite the People and GoldDerby recaps
on the night, and GoldDerby's recap URL pattern for when nobody has cited it yet.
Only hosts in HOSTS are fetched. Each URL is fetched at most once, ever: the
extracted text, or the 4xx that answered, is kept in S3 under PREFIX, a prefix
no CloudFront distribution reads. robots.txt is honoured for our User-Agent.

The text goes no further than the summarizer prompt. Nothing here is served.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

import boto3
from botocore.exceptions import ClientError

from lambdas.common.logger import get_logger
from lambdas.common.people import slug
from lambdas.common.wiki_fetch import USER_AGENT

log = get_logger(__file__)

HOSTS = {
    "people.com",
    "www.goldderby.com",
    "ew.com",
    "www.tvinsider.com",
    "parade.com",
    "www.today.com",
    "www.usmagazine.com",
    "www.eonline.com",
    "variety.com",
    "www.hollywoodreporter.com",
    "deadline.com",
    "www.tvline.com",
    "tvline.com",
    "www.usatoday.com",
    "www.vulture.com",
    "www.tvguide.com",
}
PREFIX = "recaps/"
# Seconds between two requests to one host.
GAP = 2.0
MAX_BYTES = 4_000_000
# Per couple per article: a GoldDerby block is ~1,200 characters, a People live-blog entry ~1,800.
EXCERPT = 3000
HEADING = 100
URL = re.compile(r"\|\s*url\s*=\s*(https?://[^\s|}]+)")
SKIP = {
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "header",
    "aside",
    "form",
    "button",
    "figure",
    "figcaption",
    "iframe",
}
BLOCK = {
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "br",
    "div",
    "section",
    "article",
    "tr",
    "blockquote",
}

_s3 = None
_robots: dict[str, RobotFileParser] = {}
_last: dict[str, float] = {}


def week_section(wikitext: str, week: int) -> str:
    """The raw `=== Week N` section, refs and all, or "" when the page has none yet."""
    head = re.search(rf"^===\s*Week {week}(?!\d).*$", wikitext, flags=re.MULTILINE)
    if not head:
        return ""
    rest = wikitext[head.end() :]
    end = re.search(r"^===?[^=]", rest, flags=re.MULTILINE)
    return rest[: end.start() if end else len(rest)]


def cited(section: str) -> list[str]:
    """Recap URLs the section cites on an allowed host, in page order. Archive copies are skipped."""
    out = []
    for url in URL.findall(section):
        if urlsplit(url).netloc in HOSTS and url not in out:
            out.append(url)
    return out


def guessed(season: int, year: int, theme: str | None) -> list[str]:
    """GoldDerby's recap URL for a themed night, e.g. .../2026/dancing-with-the-stars-season-35-recap-yacht-rock-night/."""
    if not theme or theme.casefold() == "premiere":
        return []
    name = slug(theme)
    if not name.endswith("night"):
        name += "-night"
    return [
        f"https://www.goldderby.com/reality-tv/{year}/dancing-with-the-stars-season-{season}-recap-{name}/"
    ]


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.parts: list[str] = []
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "meta" and dict(attrs).get("property") == "og:title":
            self.title = dict(attrs).get("content") or self.title
        if tag == "title":
            self._in_title = True
        if tag in SKIP:
            self.skip += 1
        if tag in BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
        if tag in BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title and not self.title:
            self.title = data.strip()
        if not self.skip:
            self.parts.append(data)


def extract(html: str) -> tuple[str, str]:
    """(title, article text one block per line) from a page's HTML."""
    parser = _Text()
    parser.feed(html)
    lines = (re.sub(r"\s+", " ", line).strip() for line in "".join(parser.parts).split("\n"))
    return parser.title, "\n".join(line for line in lines if line)


def _bucket() -> str:
    name = os.environ.get("RECAPS_BUCKET")
    if not name:
        raise RuntimeError("RECAPS_BUCKET is not set")
    return name


def _client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _s3


def cache_key(url: str) -> str:
    return PREFIX + hashlib.sha256(url.encode()).hexdigest() + ".json"


def _cached(url: str) -> dict | None:
    try:
        obj = _client().get_object(Bucket=_bucket(), Key=cache_key(url))
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return None
        raise
    return json.loads(obj["Body"].read())


def _store(item: dict) -> None:
    _client().put_object(
        Bucket=_bucket(),
        Key=cache_key(item["url"]),
        Body=json.dumps(item).encode(),
        ContentType="application/json",
    )


def _get(url: str) -> tuple[int, str, str]:
    """(status, final URL, body) for one polite request. A 4xx is returned; other failures raise."""
    host = urlsplit(url).netloc
    wait = _last.get(host, 0) + GAP - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last[host] = time.monotonic()
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read(MAX_BYTES)
            charset = resp.headers.get_content_charset() or "utf-8"
            return resp.status, resp.geturl(), raw.decode(charset, errors="replace")
    except HTTPError as e:
        if 400 <= e.code < 500:
            return e.code, url, ""
        raise


def allowed(url: str) -> bool:
    """robots.txt for our User-Agent, read once per host per container. Unreadable means no."""
    parts = urlsplit(url)
    host = parts.netloc
    if host not in _robots:
        rules = RobotFileParser()
        try:
            status, _, body = _get(f"{parts.scheme}://{host}/robots.txt")
        except (URLError, TimeoutError, OSError) as e:
            log.warning("robots.txt unreadable for %s: %s", host, e)
            status, body = 503, ""
        if status in (401, 403) or status >= 500:
            rules.disallow_all = True
        elif status >= 400:
            rules.allow_all = True
        else:
            rules.parse(body.splitlines())
        _robots[host] = rules
    return _robots[host].can_fetch(USER_AGENT, url)


def fetch(url: str) -> dict | None:
    """
    `{url, status, title, text}` for one article, from the S3 cache or one request.
    None when robots.txt says no or the request failed in a way worth retrying
    next run (a timeout or a 5xx); a 4xx is cached like a page, so never asked again.
    """
    if urlsplit(url).netloc not in HOSTS:
        raise ValueError(f"{url} is not on an allowed recap host")
    hit = _cached(url)
    if hit is not None:
        return hit
    if not allowed(url):
        log.info("robots.txt disallows %s", url)
        return None
    try:
        status, final, body = _get(url)
    except (URLError, TimeoutError, OSError) as e:
        log.warning("fetch failed for %s, retrying next run: %s", url, e)
        return None
    title, text = extract(body) if status == 200 else ("", "")
    item = {
        "url": url,
        "finalUrl": final,
        "status": status,
        "title": title,
        "text": text,
        "fetchedAt": int(time.time()),
    }
    _store(item)
    log.info("fetched %s: %s, %d chars", url, status, len(text))
    return item


def _tokens(contestants: list[dict]) -> list[dict[str, set[str]]]:
    """
    Name tokens to couple ids, strongest first: full names, then celebrities'
    first and last names and aliases, then pros' first names. A heading uses
    the first tier that matches, so "Julia Stiles and pro partner Ezra Sosa"
    is Julia's even though another couple's star is called Ezra. A first name
    two celebrities share is dropped, so "Connor" can't pull another couple in.
    """
    tiers: list[dict[str, set[str]]] = [{}, {}, {}]
    firsts = [
        m["name"].split()[0] for c in contestants for m in c["members"] if m["role"] == "celebrity"
    ]
    shared = {n for n in firsts if firsts.count(n) > 1}
    for c in contestants:
        cid = c["sk"].removeprefix("CONTESTANT#")
        for m in c["members"]:
            words = m["name"].replace(" Jr.", "").split()
            tiers[0].setdefault(m["name"], set()).add(cid)
            if m["role"] == "celebrity":
                names = {a.rstrip(".") for a in c.get("aliases", [])} | {words[0]}
                if len(words) > 1 and len(words[-1]) >= 4:
                    names.add(words[-1])
                for name in names - shared:
                    tiers[1].setdefault(name, set()).add(cid)
            else:
                tiers[2].setdefault(words[0], set()).add(cid)
    return tiers


def _mentions(line: str, tokens: dict[str, set[str]]) -> set[str]:
    out: set[str] = set()
    for name, cids in tokens.items():
        if re.search(rf"(?<![\w]){re.escape(name)}(?![\w])", line):
            out |= cids
    return out


def sections(text: str, contestants: list[dict]) -> dict[str, str]:
    """
    Each couple's part of one article. A recap is a run of short headings naming
    a couple ("Amber Glenn and pro partner Pasha Pashkov", "Ezra Pushed Himself
    with the Foxtrot"), each followed by its paragraphs, so a heading is a short
    line that names someone and doesn't end like a sentence. Everything before
    the first heading is the intro and is dropped.
    """
    tiers = _tokens(contestants)
    out: dict[str, list[str]] = {}
    current: set[str] = set()
    for line in text.split("\n"):
        if len(line) <= HEADING and not line.endswith((".", "!", "?", "”", '"')):
            found = next((f for t in tiers if (f := _mentions(line, t))), None)
            if found:
                current = found
        for cid in current:
            out.setdefault(cid, []).append(line)
    return {cid: "\n".join(lines)[:EXCERPT] for cid, lines in out.items()}
