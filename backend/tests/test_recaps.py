import io
import json
from email.message import Message
from urllib.error import HTTPError, URLError

import boto3
import pytest

from lambdas.common import recaps
from tests.conftest import AVATARS_BUCKET

WIKI = """
=== Week 2: Viral Hits Night ===
Each couple danced.<ref>{{Cite news |title=Live updates |url=https://people.com/dwts-live-viral-hits-123 |archive-url=https://web.archive.org/web/2026/https://people.com/dwts-live-viral-hits-123 |work=People}}</ref>
<ref>{{Cite web |url=https://www.goldderby.com/reality-tv/2026/dwts-recap-viral-hits-night/ }}</ref>
<ref>{{Cite web |url=https://www.detpress.com/abc/pressrelease/viral-hits/ }}</ref>
<ref>{{Cite web |url=https://people.com/dwts-live-viral-hits-123 }}</ref>
==== Scores ====
{| class="wikitable"
|}
=== Week 3: Yacht Rock Night ===
<ref>{{Cite web |url=https://ew.com/week-3 }}</ref>
"""


def couple(cid: str, celeb: str, pro: str, aliases: list[str] | None = None) -> dict:
    return {
        "sk": f"CONTESTANT#{cid}",
        "aliases": aliases or [],
        "members": [{"name": celeb, "role": "celebrity"}, {"name": pro, "role": "pro"}],
    }


CAST = [
    couple("ezra-frech", "Ezra Frech", "Daniella Karagach"),
    couple("julia-stiles", "Julia Stiles", "Ezra Sosa"),
    couple("connor-wood", "Connor Wood", "Rylee Arnold", ["Connor W."]),
    couple("connor-smith", "Connor Smith", "Emma Slater"),
    couple("harry-shum-jr", "Harry Shum Jr.", "Rylee Arnold"),
]

RECAP = """<html><head><title>x</title><meta property="og:title" content="DWTS recap: Viral Hits"></head>
<body><nav>Home | TV</nav><script>var x = "Julia Stiles";</script>
<p>Read on for our recap of who stood out tonight.</p>
<h2>Julia Stiles and pro partner Ezra Sosa</h2>
<p>Performance: Salsa to &ldquo;Song&rdquo; by Someone</p>
<p>Derek&#39;s comments: "A breath of fresh air."</p>
<figure><img src="a.jpg"><figcaption>Ezra Frech and Daniella Karagach.</figcaption></figure>
<h3>Ezra Pushed Himself with the Foxtrot</h3>
<p>Ezra told Daniella he wanted to nail it.</p>
<h3>Connor Got a Shock</h3>
<p>Connor was surprised.</p>
<h3>Shum Brings the Heat</h3>
<p>Harry danced a paso.</p>
<footer>Copyright</footer></body></html>"""


def test_week_section_stops_at_the_next_week_and_keeps_subsections():
    section = recaps.week_section(WIKI, 2)
    assert "Scores" in section
    assert "ew.com" not in section
    assert recaps.week_section(WIKI, 9) == ""


def test_cited_keeps_allowed_hosts_once_in_page_order():
    assert recaps.cited(recaps.week_section(WIKI, 2)) == [
        "https://people.com/dwts-live-viral-hits-123",
        "https://www.goldderby.com/reality-tv/2026/dwts-recap-viral-hits-night/",
    ]


def test_guessed_follows_the_goldderby_pattern():
    assert recaps.guessed(35, 2026, "Yacht Rock") == [
        "https://www.goldderby.com/reality-tv/2026/dancing-with-the-stars-season-35-recap-yacht-rock-night/"
    ]
    assert recaps.guessed(35, 2026, "Dedication Night") == [
        "https://www.goldderby.com/reality-tv/2026/dancing-with-the-stars-season-35-recap-dedication-night/"
    ]
    assert recaps.guessed(35, 2026, "Premiere") == []
    assert recaps.guessed(35, 2026, None) == []


def test_extract_drops_chrome_scripts_and_captions():
    title, text = recaps.extract(RECAP)
    assert title == "DWTS recap: Viral Hits"
    assert "var x" not in text and "Home | TV" not in text and "Copyright" not in text
    assert "Ezra Frech and Daniella Karagach." not in text
    assert "Performance: Salsa to “Song” by Someone" in text.split("\n")


def test_sections_split_by_couple_heading():
    _, text = recaps.extract(RECAP)
    got = recaps.sections(text, CAST)
    # A full name outranks another star's first name.
    assert got["julia-stiles"].startswith("Julia Stiles and pro partner Ezra Sosa")
    assert "breath of fresh air" in got["julia-stiles"]
    assert "breath of fresh air" not in got.get("ezra-frech", "")
    # A celebrity's first name outranks a pro's.
    assert "nail it" in got["ezra-frech"]
    assert "nail it" not in got["julia-stiles"]
    # Two stars named Connor: the first name alone names nobody.
    assert "connor-wood" not in got and "connor-smith" not in got
    # Last name, with the suffix off.
    assert got["harry-shum-jr"].endswith("Harry danced a paso.")
    # The intro before the first heading is nobody's.
    assert all("Read on" not in v for v in got.values())


def test_sections_cap_each_excerpt():
    text = "Julia Stiles and Ezra Sosa\n" + "\n".join(["She danced well and smiled."] * 500)
    assert len(recaps.sections(text, CAST)["julia-stiles"]) == recaps.EXCERPT


class Web:
    """Stubs urlopen: robots.txt and pages by URL; records each request."""

    def __init__(self, monkeypatch, pages: dict):
        self.pages = pages
        self.calls: list[str] = []
        monkeypatch.setattr(recaps, "urlopen", self.urlopen)
        monkeypatch.setattr(recaps.time, "sleep", lambda s: None)

    def urlopen(self, req, timeout):
        url = req.full_url
        self.calls.append(url)
        assert req.get_header("User-agent") == recaps.USER_AGENT
        got = self.pages.get(url, 404)
        if isinstance(got, Exception):
            raise got
        if isinstance(got, int):
            raise HTTPError(url, got, "status", Message(), None)
        resp = io.BytesIO(got.encode())
        resp.status = 200
        resp.headers = Message()
        resp.headers["Content-Type"] = "text/html; charset=utf-8"
        resp.geturl = lambda: url
        return resp


@pytest.fixture
def web(aws, monkeypatch):
    monkeypatch.setattr(recaps, "_s3", None)
    monkeypatch.setattr(recaps, "_robots", {})
    monkeypatch.setattr(recaps, "_last", {})
    return lambda pages: Web(monkeypatch, pages)


URL = "https://www.goldderby.com/reality-tv/2026/dwts-recap-viral-hits-night/"


def test_fetch_caches_the_text_and_never_asks_again(web):
    w = web(
        {
            "https://www.goldderby.com/robots.txt": "User-agent: *\nDisallow: /wp-admin/\n",
            URL: RECAP,
        }
    )
    first = recaps.fetch(URL)
    assert first["status"] == 200 and first["title"] == "DWTS recap: Viral Hits"
    assert "Julia Stiles" in first["text"]
    stored = boto3.client("s3").get_object(Bucket=AVATARS_BUCKET, Key=recaps.cache_key(URL))
    assert json.loads(stored["Body"].read())["text"] == first["text"]
    assert recaps.cache_key(URL).startswith("recaps/")

    calls = len(w.calls)
    recaps._robots.clear()
    assert recaps.fetch(URL) == first
    assert len(w.calls) == calls


def test_fetch_caches_a_404_so_a_wrong_guess_costs_one_request(web):
    w = web({"https://www.goldderby.com/robots.txt": ""})
    assert recaps.fetch(URL)["status"] == 404
    assert recaps.fetch(URL)["status"] == 404
    assert w.calls.count(URL) == 1


def test_fetch_retries_a_timeout_next_run(web):
    w = web({"https://www.goldderby.com/robots.txt": "", URL: URLError("timed out")})
    assert recaps.fetch(URL) is None
    w.pages[URL] = RECAP
    assert recaps.fetch(URL)["status"] == 200


def test_fetch_honours_robots(web):
    w = web(
        {
            "https://www.goldderby.com/robots.txt": "User-agent: *\nDisallow: /reality-tv/\n",
            URL: RECAP,
        }
    )
    assert recaps.fetch(URL) is None
    assert URL not in w.calls


def test_a_forbidden_robots_txt_means_no(web):
    w = web({"https://www.goldderby.com/robots.txt": 403, URL: RECAP})
    assert recaps.fetch(URL) is None
    assert URL not in w.calls


def test_fetch_refuses_hosts_off_the_list(web):
    web({})
    with pytest.raises(ValueError):
        recaps.fetch("https://example.com/recap")
