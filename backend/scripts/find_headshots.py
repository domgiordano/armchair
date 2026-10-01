#!/usr/bin/env python3
"""Finds a free Wikimedia Commons headshot for every person in fixtures/seasons/.

    cd backend
    python scripts/find_headshots.py            # resolve people not yet in the registry, apply
    python scripts/find_headshots.py --apply    # only copy the registry into the fixtures

fixtures/headshots.json maps each name as the fixtures spell it to a headshot or null.
A name already there is never looked up again: delete its entry to retry it.

The person's article is the one a season page links the name to, else the article the
name itself leads to when that links to the show. It only counts when its Wikidata item
is a human labelled with the name: some names redirect to the show's own article (S1's
Charlotte Jørgensen), and "Jenna Johnson" is a different person from the dancer.

Per person, in order, the first file that is on Commons, free and not a network photo:
1. the article's Wikidata P18 image
2. the article's free lead image (pageimages)
3. a file in the person's Commons category (Wikidata P373, else the category with their
   name when it is filed under dance) whose file name or description is the person alone
4. a Commons search hit whose file name is the person's and whose page mentions dancing
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from functools import partial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.build_season import SEASONS, UA, words

REGISTRY = SEASONS.parent / "headshots.json"
WIKIPEDIA = "https://en.wikipedia.org/w/api.php"
WIKIDATA = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
FREE = re.compile(r"^(CC BY(-SA)? \d(\.\d)?|CC0|Public domain|PD\b)", re.IGNORECASE)
# Network publicity stills have reached Commons under free licenses before being deleted.
# A record label or studio as author means a publicity still, whatever the license says.
PRESS = re.compile(
    r"\b(ABC|Disney|press (photo|release|kit)|publicity|Records|Studios)\b", re.IGNORECASE
)
# Some P18 images of people are their signature or their grave.
NOT_A_FACE = re.compile(r"signature|autograph|grave|headstone|tomb", re.IGNORECASE)
IMAGE = {"image/jpeg", "image/png", "image/webp"}
# Words a file name may add to the person's name: "Witney Carson 2019 (cropped).jpg".
FILLER = {"cropped", "crop", "headshot", "portrait"}
# Where the name is followed by a place or a credit: "Jan Ravnik at Tribeca Film Festival 2026",
# "Witney Carson 2019 by Glenn Francis".
AT = {"at", "in", "on", "during", "by"}
SHOW = "Dancing with the Stars (American TV series)"
# Looked at by hand and left null. Registry entries, so they are never resolved again.
SKIP = {
    "Guillermo Rodriguez": "the Commons description names Guillermo Díaz",
    "Daniella Karagach": "the only free photo is a two-person dance shot",
}
# Files that pass every check but show no usable face, from looking at them.
REJECT = {
    "Aldrin_Apollo_11_(3x5_crop).jpg": "helmet visor",
    "Visually_impaired_woman_number_4b.JPG": "skiing, far away",
    "David_Ross_on_June_14,_2009.jpg": "from behind",
    "Kenny_Mayne_(764944742)_(cropped).jpg": "kayaking, far away",
    "Rashad_Jennings.jpg": "from behind",
    "Rashad_Jennings_(15357256265).jpg": "in a pile of players",
    "Women's_visually_impaired_superg_skier_number_5f.JPG": "ski goggles and helmet",
    "Kim_Zolciak_and_Allison_DeMarcus.jpg": "two people in a crowd",
    "DSD_hosts_The_Secretary_of_Defense_Employer_Support_Freedom_Awards_Ceremony_170825-D-SV709-004.jpg": "far away at a podium",
    "Ginger_Zee_at_Pre-White_House_Correspondents'_Dinner_Reception_Pre-Party_-_13927260579.jpg": "in front of an ABC News backdrop",
}


def get(url: str, params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json", "formatversion": 2})
    req = urllib.request.Request(f"{url}?{query}", headers={**UA, "Accept-Encoding": "identity"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def query_all(url: str, params: dict) -> list[dict]:
    """Every page of a `query` response, following `continue`; props merged per page."""
    pages: dict[str, dict] = {}
    redirects: list[dict] = []
    cont: dict = {}
    while True:
        data = get(url, {"action": "query", **params, **cont})
        q = data.get("query", {})
        redirects += q.get("redirects", [])
        for p in q.get("pages", []):
            merged = pages.setdefault(p["title"], {})
            for k, v in p.items():
                merged[k] = {**merged[k], **v} if isinstance(v, dict) and k in merged else v
        if "continue" not in data:
            return [*pages.values(), *({"redirect": r} for r in redirects)]
        cont = data["continue"]
        time.sleep(0.2)


def same(a: str, b: str) -> bool:
    return words(re.sub(r"\s*\(.*\)$", "", a)) == words(b)


def candidates(rows: list[dict], names: set[str]) -> dict[str, list[dict]]:
    """{name: article pages that name could mean}, from a query's pages and redirects."""
    pages = {
        r["title"]: r
        for r in rows
        if "wikibase_item" in r.get("pageprops", {}) and "disambiguation" not in r["pageprops"]
    }
    redirects = [(r["redirect"]["from"], r["redirect"]["to"]) for r in rows if "redirect" in r]
    found = {}
    for name in names:
        titles = [t for t in pages if same(t, name)]
        titles += [to for frm, to in redirects if same(frm, name) and to in pages]
        if titles:
            found[name] = [pages[t] for t in titles]
    return found


PROPS = {"prop": "pageprops", "ppprop": "wikibase_item|page_image_free|disambiguation"}


def linked(title: str, names: set[str]) -> dict[str, list[dict]]:
    """Candidates among the articles the season page links to."""
    params = {"titles": title, "generator": "links", "gplnamespace": 0, "gpllimit": "max"}
    return candidates(query_all(WIKIPEDIA, {**params, "redirects": 1, **PROPS}), names)


def direct(names: set[str]) -> dict[str, list[dict]]:
    """Candidates among the articles the names themselves lead to, if they link to the show."""
    found = {}
    for chunk in (sorted(names)[i : i + 50] for i in range(0, len(names), 50)):
        params = {**PROPS, "prop": "pageprops|links", "pltitles": SHOW, "redirects": 1}
        rows = query_all(WIKIPEDIA, {**params, "titles": "|".join(chunk)})
        found |= candidates([r for r in rows if "redirect" in r or r.get("links")], set(chunk))
    return found


def items(qids: list[str]) -> dict[str, dict]:
    out = {}
    for i in range(0, len(qids), 50):
        data = get(
            WIKIDATA,
            {
                "action": "wbgetentities",
                "ids": "|".join(qids[i : i + 50]),
                "props": "claims|labels|aliases",
                "languages": "en|mul",
            },
        )
        out |= data["entities"]
        time.sleep(0.2)
    return out


def claim(item: dict, prop: str) -> str | None:
    for c in item.get("claims", {}).get(prop, []):
        snak = c["mainsnak"]
        if snak["snaktype"] == "value":
            return snak["datavalue"]["value"]
    return None


def is_person(item: dict, name: str) -> bool:
    human = any(
        c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") == "Q5"
        for c in item.get("claims", {}).get("P31", [])
    )
    return human and any(same(label, name) for label in labels(item))


def labels(item: dict) -> list[str]:
    """English labels, then aliases. "mul" is the label Wikidata now keeps for every language."""
    names = [item.get("labels", {}).get(lang, {}).get("value") for lang in ("en", "mul")]
    names += [a["value"] for lang in ("en", "mul") for a in item.get("aliases", {}).get(lang, [])]
    return [n for n in names if n]


def file_info(files: list[str]) -> dict[str, dict]:
    """{file name with underscores: imageinfo} for the files hosted on Commons."""
    out = {}
    for i in range(0, len(files), 50):
        rows = query_all(
            COMMONS,
            {
                "titles": "|".join(f"File:{f}" for f in files[i : i + 50]),
                "prop": "imageinfo",
                "iiprop": "url|mime|extmetadata",
                "iiextmetadatafilter": "Artist|Credit|LicenseShortName|ImageDescription|Categories",
            },
        )
        for r in rows:
            if r.get("imageinfo") and r.get("imagerepository") == "local":
                out[r["title"].removeprefix("File:").replace(" ", "_")] = r["imageinfo"][0]
    return out


def meta(info: dict, key: str) -> str:
    raw = info["extmetadata"].get(key, {}).get("value", "")
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", raw)).split())


def usable(file: str, info: dict) -> bool:
    text = " ".join(meta(info, k) for k in ("Artist", "Credit", "ImageDescription"))
    return (
        file not in REJECT
        and not NOT_A_FACE.search(file + " " + meta(info, "ImageDescription"))
        and info["mime"] in IMAGE
        and bool(FREE.match(meta(info, "LicenseShortName")))
        and not PRESS.search(text + " " + info["descriptionurl"])
    )


def named(file: str, name: str) -> bool:
    """The file name is the person's name, then years, counters and FILLER, or an AT place."""
    stem = urllib.parse.unquote(file).rsplit(".", 1)[0].replace("_", " ")
    w = words(stem)
    n = words(name)
    if w[: len(n)] != n:
        return False
    rest = [t for t in w[len(n) :] if not t.isdigit()]
    return (bool(rest) and rest[0] in AT) or all(t in FILLER for t in rest)


def category_files(category: str) -> list[str]:
    data = get(
        COMMONS,
        {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": "file",
            "cmlimit": "max",
        },
    )
    return [
        m["title"].removeprefix("File:").replace(" ", "_") for m in data["query"]["categorymembers"]
    ]


def about_dancing(category: str) -> bool:
    """A Commons category filed under dance: "Chelsie Hightower" is in "American female dancers"."""
    rows = query_all(COMMONS, {"titles": f"Category:{category}", "prop": "categories"})
    parents = [c["title"] for r in rows for c in r.get("categories", [])]
    return any("danc" in p.lower() for p in parents)


def solo(names: tuple[str, ...], info: dict) -> bool:
    """The description starts with one of the person's names and names nobody alongside."""
    text = meta(info, "ImageDescription")
    alone = not re.search(r"\b(and|with)\b|&", text)
    return alone and any(same(text[: len(n)], n) for n in names)


def search_files(name: str) -> list[str]:
    data = get(
        COMMONS,
        {
            "action": "query",
            "list": "search",
            "srsearch": f'intitle:"{name}" filetype:bitmap',
            "srnamespace": 6,
            "srlimit": 20,
        },
    )
    return [m["title"].removeprefix("File:").replace(" ", "_") for m in data["query"]["search"]]


def credit(file: str, info: dict) -> dict:
    return {
        "file": file,
        "author": meta(info, "Artist") or meta(info, "Credit") or "Unknown author",
        "license": meta(info, "LicenseShortName"),
        "sourceUrl": info["descriptionurl"],
    }


def pick(files: list[str], ok=lambda info: True) -> dict | None:
    infos = file_info(files) if files else {}
    for file in (f.replace(" ", "_") for f in files):
        info = infos.get(file)
        if info and usable(file, info) and ok(info):
            return credit(file, info)
    return None


def dancing(info: dict) -> bool:
    """A search hit only counts when Commons files it under dance: names repeat."""
    return "danc" in (meta(info, "ImageDescription") + meta(info, "Categories")).lower()


def articles(people: dict[str, set[str]]) -> dict[str, tuple[dict, dict]]:
    """{name: (article page, Wikidata item)} for the people with an article."""
    found: dict[str, list[dict]] = {}
    for title in sorted({t for titles in people.values() for t in titles}):
        want = {n for n, titles in people.items() if title in titles}
        for name, pages in linked(title, want).items():
            found.setdefault(name, []).extend(pages)
        time.sleep(0.5)

    def settle(found: dict[str, list[dict]]) -> dict[str, tuple[dict, dict]]:
        wikidata = items(
            sorted({p["pageprops"]["wikibase_item"] for ps in found.values() for p in ps})
        )
        out = {}
        for name, pages in found.items():
            for page in pages:
                item = wikidata[page["pageprops"]["wikibase_item"]]
                if is_person(item, name):
                    out[name] = (page, item)
                    break
        return out

    out = settle(found)
    return out | settle(direct(set(people) - set(out)))


def resolve(people: dict[str, set[str]]) -> dict[str, dict | None]:
    """{name: headshot or None} for every name in `people` ({name: season page titles})."""
    known = articles(people)
    out = {}
    for name in sorted(people):
        page, item = known.get(name, ({"pageprops": {}}, {}))
        label = (labels(item) or [name])[0]
        shot = pick(
            [f for f in (claim(item, "P18"), page["pageprops"].get("page_image_free")) if f]
        )
        # The item's own Commons category, else one named for the person that dance files under.
        cats = [claim(item, "P373")] + [c for c in (name, label) if about_dancing(c)]
        for cat in dict.fromkeys(c for c in cats if c):
            files = category_files(cat)[:100]
            if not shot:
                shot = pick([f for f in files if named(f, name) or named(f, label)])
            if not shot:
                shot = pick(files, partial(solo, (name, label)))
        for query in dict.fromkeys([name, label]):
            if not shot:
                shot = pick([f for f in search_files(query) if named(f, query)], dancing)
        out[name] = shot
        print(f"{name}: {shot['file'] if shot else '-'}", flush=True)
        time.sleep(0.2)
    return out


def fixtures() -> list[Path]:
    return sorted(SEASONS.glob("dwts-*.json"), key=lambda p: int(p.stem.split("-")[1]))


def everyone(season: dict) -> list[dict]:
    return [m for c in season["contestants"] for m in c["members"]] + season["judges"]


def apply(registry: dict[str, dict | None]) -> None:
    for path in fixtures():
        season = json.loads(path.read_text())
        for p in everyone(season):
            p["headshot"] = registry.get(p["name"])
        path.write_text(json.dumps(season, indent=2, ensure_ascii=False) + "\n")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="find_headshots")
    parser.add_argument(
        "--apply", action="store_true", help="only write the registry into fixtures"
    )
    args = parser.parse_args(argv)

    registry = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    if not args.apply:
        people: dict[str, set[str]] = {}
        for path in fixtures():
            season = json.loads(path.read_text())
            for p in everyone(season):
                people.setdefault(p["name"], set()).add(season["wikiTitle"])
        todo = {n: t for n, t in people.items() if n not in registry and n not in SKIP}
        registry |= {n: None for n in SKIP} | resolve(todo)
        registry = dict(sorted(registry.items()))
        REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    apply(registry)


if __name__ == "__main__":
    main()
