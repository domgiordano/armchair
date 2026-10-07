"""
A photo and a page for a guest judge the poller meets on the night, before anyone
has added them to the season fixture.

The article is the Wikipedia page the panel name leads to, used only when its
Wikidata item is a human. The photo is that item's P18 image, only when Commons
says it is free and it is not a network still. The rules are the ones
scripts/find_headshots.py and scripts/find_bios.py apply to the fixtures; this
side runs without OpenCV, so the photo is Commons' 400px thumbnail as it comes,
not a face crop. The UI centres it high (components/headshot.tsx), and adding
the guest to the fixture and re-seeding replaces it with a real crop.

A guest who is already in the person index, a former pro say, keeps their photo
and bio and gains a judge stint for the season.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import urllib.request
from urllib.error import HTTPError
from urllib.parse import quote, urlencode

import boto3

from lambdas.common.dynamo import query_all, table, update

UA = {"User-Agent": "armchair/0.1 (https://github.com/domgiordano/armchair)"}
SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
WIKIDATA = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
# Four lookups and an upload inside the poller's 30s timeout, after the scores are written.
TIMEOUT = 4
THUMB = 400
FREE = re.compile(r"^(CC BY(-SA)? \d(\.\d)?|CC0|Public domain|PD\b)", re.IGNORECASE)
# Network publicity stills have reached Commons under free licenses before being deleted.
# A record label or studio as author means a publicity still, whatever the license says.
PRESS = re.compile(
    r"\b(ABC|Disney|press (photo|release|kit)|publicity|Records|Studios)\b", re.IGNORECASE
)
IMAGE = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
SENTENCES = 3
MAX_CHARS = 420
# A full stop after these is not the end of a sentence: "Dr. Oz", "Jr.", "U.S.".
ABBREV = re.compile(r"(\b[A-Z]|\b(?:Mr|Mrs|Ms|Dr|Jr|Sr|St|Mt|No|vs|U\.S|Inc|Ltd|Co))\.$")


def seat(jid: str, regulars: list[str], episodes: list[dict]) -> dict:
    """A judge off the season's default panel is a guest, shown with the weeks they sat in."""
    if jid in regulars:
        return {"guest": False}
    weeks = {int(e["week"]) for e in episodes if jid in (e.get("panel") or [])}
    return {"guest": True, "weeks": sorted(weeks)}


def sentences(extract: str) -> str:
    """The first SENTENCES sentences, fewer when they would run past MAX_CHARS."""
    out: list[str] = []
    rest = " ".join(extract.split())
    while rest and len(out) < SENTENCES:
        cut = _sentence_end(rest)
        sentence, rest = rest[:cut].strip(), rest[cut:].strip()
        if out and len(" ".join([*out, sentence])) > MAX_CHARS:
            break
        out.append(sentence)
    return " ".join(out)


def _sentence_end(text: str) -> int:
    for m in re.finditer(r"[.!?](?=\s+[\"'(A-Z0-9])", text):
        if not ABBREV.search(text[: m.end()]):
            return m.end()
    return len(text)


def _get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=TIMEOUT) as resp:
        return resp.read()


def _api(url: str, params: dict) -> dict:
    return json.loads(_get(f"{url}?{urlencode({**params, 'format': 'json', 'formatversion': 2})}"))


def _meta(info: dict, key: str) -> str:
    raw = info.get("extmetadata", {}).get(key, {}).get("value", "")
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", raw)).split())


def lookup(name: str) -> tuple[dict | None, dict | None]:
    """(bio, Commons imageinfo of a free photo) for the person `name` leads to, either None."""
    try:
        page = json.loads(_get(SUMMARY + quote(name.replace(" ", "_"), safe="")))
    except HTTPError as e:
        if e.code == 404:
            return None, None
        raise
    qid = page.get("wikibase_item")
    if page.get("type") != "standard" or not qid:
        return None, None
    item = _api(WIKIDATA, {"action": "wbgetentities", "ids": qid, "props": "claims"})
    claims = item["entities"][qid].get("claims", {})
    values = {
        p: [c["mainsnak"].get("datavalue", {}).get("value") for c in claims.get(p, [])]
        for p in ("P31", "P18")
    }
    if not any(v and v.get("id") == "Q5" for v in values["P31"]):
        return None, None
    bio = {
        "title": page["title"],
        "url": page["content_urls"]["desktop"]["page"],
        "description": page.get("description"),
        "extract": sentences(page.get("extract") or ""),
    }
    file = next((f for f in values["P18"] if f), None)
    if file is None:
        return bio, None
    found = _api(
        COMMONS,
        {
            "action": "query",
            "titles": f"File:{file}",
            "prop": "imageinfo",
            "iiprop": "url|mime|sha1|extmetadata",
            "iiurlwidth": THUMB,
            "iiextmetadatafilter": "Artist|Credit|LicenseShortName|ImageDescription",
        },
    )["query"]["pages"][0]
    if found.get("imagerepository") != "local" or not found.get("imageinfo"):
        return bio, None
    info = {**found["imageinfo"][0], "file": file.replace(" ", "_")}
    credit = " ".join(_meta(info, k) for k in ("Artist", "Credit", "ImageDescription"))
    free = (
        info["mime"] in IMAGE
        and FREE.match(_meta(info, "LicenseShortName"))
        and not PRESS.search(f"{credit} {info['descriptionurl']}")
    )
    return bio, info if free else None


def upload(jid: str, info: dict) -> dict:
    """Copies the thumbnail to the site bucket's headshots/auto/ and returns its credit."""
    image = (
        f"auto/{jid}-{hashlib.sha256(info['sha1'].encode()).hexdigest()[:10]}.{IMAGE[info['mime']]}"
    )
    boto3.client("s3").put_object(
        Bucket=os.environ["SITE_BUCKET"],
        Key=f"headshots/{image}",
        Body=_get(info["thumburl"]),
        ContentType=info["mime"],
        CacheControl="public, max-age=31536000, immutable",
    )
    return {
        "file": info["file"],
        "image": image,
        "author": _meta(info, "Artist") or _meta(info, "Credit") or "Unknown author",
        "license": _meta(info, "LicenseShortName"),
        "sourceUrl": info["descriptionurl"],
        "source": "auto",
    }


def profile(show: str, season: int, jid: str, name: str, t: int) -> None:
    """
    Gives one guest a PERSON item, a PEOPLE search row and, where Commons has a free
    photo, a headshot on their JUDGE# item. `profiledAt` marks the judge done
    whatever was found; a raised lookup leaves it unset, so the next tick retries.
    """
    pk = f"PERSON#{show}#{jid}"
    person = next((r for r in query_all(table("CATALOG_TABLE"), pk) if r["sk"] == "META"), None)
    stint = {"season": season, "role": "judge"}
    if person is None:
        bio, info = lookup(name)
        headshot = info and upload(jid, info)
        roles, seasons = ["judge"], [stint]
        update(
            "CATALOG_TABLE",
            {"pk": pk, "sk": "META"},
            {"name": name, "roles": roles, "headshot": headshot, "seasons": seasons, "bio": bio},
            "attribute_not_exists(sk)",
        )
    else:
        headshot = person.get("headshot")
        roles = list(dict.fromkeys(["judge", *person.get("roles", [])]))
        seasons = person.get("seasons", [])
        if not any(int(s["season"]) == season and s["role"] == "judge" for s in seasons):
            seasons = [*seasons, stint]
        update("CATALOG_TABLE", {"pk": pk, "sk": "META"}, {"roles": roles, "seasons": seasons})
        name = person["name"]
    update(
        "CATALOG_TABLE",
        {"pk": f"PEOPLE#{show}", "sk": f"PERSON#{jid}"},
        {
            "name": name,
            "roles": roles,
            "headshot": headshot and headshot["image"],
            "seasons": sorted({int(s["season"]) for s in seasons}),
        },
    )
    update(
        "CATALOG_TABLE",
        {"pk": f"SEASON#{show}#{season}", "sk": f"JUDGE#{jid}"},
        {"profiledAt": t, **({"headshot": headshot} if headshot else {})},
    )
