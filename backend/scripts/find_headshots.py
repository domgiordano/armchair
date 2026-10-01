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

Per person, the first file that is on Commons, free, not a network photo, and has one
clear face that faces.crop() can centre on:
1. the Wikidata item's own P18 image
2. a file whose Commons structured data says it depicts that item (P180), solo depictions
   and files named for the person first. The article's lead image only counts this way.
Category members and name searches are never used: they turned up namesakes and crowds.
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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import faces
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
# Whole words only: "TomBergeronApr09.jpg" is not a tomb.
NOT_A_FACE = re.compile(
    r"(?<![a-z])(signature|autograph|grave|headstone|tomb)(?![a-z])", re.IGNORECASE
)
IMAGE = {"image/jpeg", "image/png", "image/webp"}
SHOW = "Dancing with the Stars (American TV series)"
# Looked at by hand and left null. Registry entries, so they are never resolved again.
SKIP = {
    "Guillermo Rodriguez": "the Commons description names Guillermo Díaz",
}
# People whose only good free photo fails the automatic rules, cropped by hand after looking
# at it: (file, (left, top, side) in the faces.WIDTH px thumbnail). The license and
# network-photo checks still apply; the face count, depicts and REJECT do not.
MANUAL = {
    # Her only Commons photo. The crop clears the street signs; the sunglasses stay.
    "Carrie Ann Inaba": ("Carrie_Ann_Inaba.jpg", (146, 112, 104)),
    # Photographers behind him are cropped out.
    "Len Goodman": ("Len_Goodman_1.JPG", (340, 60, 380)),
    # The 2012 photo is in profile against a logo wall; this one leaves out her partner.
    "Sharna Burgess": (
        "2017_500_Festival_Parade_-_Celebrities_-_Sharna_Burgess_(crop).jpg",
        (245, 130, 150),
    ),
    # Tight on the face: the rest of the frame is a dark, busy dance floor.
    "Pasha Pashkov": ("Pasha_Pashkov_on_Panache_Star_Dancesport.jpg", (245, 0, 175)),
    "Daniella Karagach": ("Daniella_Karagach_on_Panache_Star_Dancesport.jpg", (140, 25, 150)),
}
# Files that pass every check but are no usable headshot, from looking at the contact sheet.
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
    "Carrie_Ann_Inaba.jpg": "sunglasses, street signs behind",
    "Derek_Fisher_Thunder.jpg": "mid-shot, arms over his head",
    "Hines_Ward_Steelers.jpg": "face behind a helmet facemask",
    "Ginger_Zee_May_2014.jpg": "ABC logo behind her",
    "Jerry_Rice.jpg": "off to one side of a sign",
    "Jojo_Siwa_on_the_iHeart_Awards_2024_01.jpg": "face paint hides her face",
    "Jack_Wagner_2009.jpg": "mid golf swing, looking down",
    "Laurie_Hernandez_2016-08-04.jpg": "looking down mid-routine",
    "Kellie_Pickler_Al_Asad_4.jpg": "blurred, arms in the air",
    "Kenny_ortega.jpg": "dark, looking down",
    "Kim_Zolciak.jpg": "washed out and blurred",
    "Lindsey_Stirling_Portrait.jpg": "playing violin, face behind her hair",
    "Lil'_Kim_-_crop_3_(cropped).png": "on a dark stage, blurred",
    "Josie_Maran_(face).jpg": "blurred",
    "Kurt_Warner.jpg": "far away at a podium",
    "Matt_James_(51914462301)_(cropped)_(cropped).jpg": "looking straight up",
    "Misty_May-Treanor.jpg": "sunglasses, looking down mid-game",
    "Nagasu_2010_TEB.jpg": "far away on the ice",
    "Pasha_Pashkov_on_Panache_Star_Dancesport.jpg": "dark and blurred",
    "PhaedraParks2018.png": "dark and blurred",
    "Rylee_Arnold.jpg": "blurred, face cut off",
    "Sailor_Brinkley_Cook_2013_01.jpg": "blurred",
    "Sharna_Burgess_October_2,2012.jpg": "side-on in front of a logo wall",
    "Sean_Spicer.jpg": "far away at the press room podium",
    "TaylorHanson.jpg": "blurred under red stage light",
    "Tonya_harding_mac_club_1994_crop.jpg": "pixelated",
    "Wynonna_Judd_is_performing.jpg": "on stage, turned away",
    "Hines_Ward_vs._Chiefs.jpg": "face behind a helmet facemask",
    "Jack_Wagner.jpg": "visor down, looking at the ground",
    "JoJo_Siwa_driving_her_car_in_Beverly_Hills.jpg": "side-on through a car window",
    "Misty_May-Treanor_plays_volleyball_with_wounded_warriors,_130511-M-IX060-011.jpg": "mid-shout",
    "Antonio_Brown_2015.jpg": "face behind a helmet facemask",
    "Women's_visually_impaired_superg_skier_number_5d.JPG": "ski goggles and helmet",
    "Matt_James_(51914462301).jpg": "looking straight up",
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
        # Dropped connections ("No route to host") come and go.
        except urllib.error.URLError:
            if attempt == 3:
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
                "iiprop": "url|mime|sha1|extmetadata",
                "iiextmetadatafilter": "Artist|Credit|LicenseShortName|ImageDescription|Categories",
            },
        )
        for r in rows:
            if r.get("imageinfo") and r.get("imagerepository") == "local":
                file = r["title"].removeprefix("File:").replace(" ", "_")
                out[file] = {**r["imageinfo"][0], "pageid": r["pageid"]}
    return out


def meta(info: dict, key: str) -> str:
    raw = info["extmetadata"].get(key, {}).get("value", "")
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", raw)).split())


def usable(file: str, info: dict) -> bool:
    text = " ".join(meta(info, k) for k in ("Artist", "Credit", "ImageDescription"))
    return (
        not NOT_A_FACE.search(file + " " + meta(info, "ImageDescription"))
        and info["mime"] in IMAGE
        and bool(FREE.match(meta(info, "LicenseShortName")))
        and not PRESS.search(text + " " + info["descriptionurl"])
    )


def depicting(qid: str) -> list[str]:
    """Commons files whose structured data says they depict the Wikidata item."""
    data = get(
        COMMONS,
        {
            "action": "query",
            "list": "search",
            "srsearch": f"haswbstatement:P180={qid} filetype:bitmap",
            "srnamespace": 6,
            "srlimit": 50,
        },
    )
    return [m["title"].removeprefix("File:").replace(" ", "_") for m in data["query"]["search"]]


def depicts(infos: dict[str, dict]) -> dict[str, set[str]]:
    """{file: the Wikidata items its Commons structured data (P180) says it depicts}."""
    mids = {f"M{info['pageid']}": file for file, info in infos.items()}
    out: dict[str, set[str]] = {file: set() for file in infos}
    keys = sorted(mids)
    for i in range(0, len(keys), 50):
        data = get(COMMONS, {"action": "wbgetentities", "ids": "|".join(keys[i : i + 50])})
        for mid, entity in data["entities"].items():
            # A file with no statements has `"statements": []`, a PHP empty array.
            for s in (entity.get("statements") or {}).get("P180", []):
                if "datavalue" in s["mainsnak"]:
                    out[mids[mid]].add(s["mainsnak"]["datavalue"]["value"]["id"])
        time.sleep(0.2)
    return out


def titled(file: str, name: str) -> bool:
    """The person's name, word for word, somewhere in the file name."""
    w, n = words(urllib.parse.unquote(file).replace("_", " ")), words(name)
    return any(w[i : i + len(n)] == n for i in range(len(w) - len(n) + 1))


def order(
    qid: str, p18: str | None, files: list[str], shows: dict[str, set[str]], names: list[str]
) -> list[str]:
    """Files to try, best first: the item's own P18, then files that depict the person,
    those depicting nobody else and named for them first. Anything else is never tried:
    a Wikipedia lead image or a Commons search hit can be someone else, or a crowd."""
    rest = [f for f in dict.fromkeys(files) if f != p18 and qid in shows.get(f, set())]
    rest.sort(key=lambda f: (len(shows[f]) > 1, not any(titled(f, n) for n in names)))
    return ([p18] if p18 else []) + rest


def credit(name: str, file: str, info: dict, box: tuple[int, int, int] | None = None) -> dict:
    return {
        "file": file,
        "image": faces.key(name, info["sha1"], box),
        "author": meta(info, "Artist") or meta(info, "Credit") or "Unknown author",
        "license": meta(info, "LicenseShortName"),
        "sourceUrl": info["descriptionurl"],
        **({"box": list(box)} if box else {}),
    }


def manual(name: str) -> dict:
    """The MANUAL headshot, credited, with its box for seed_season to crop."""
    file, box = MANUAL[name]
    info = file_info([file])[file]
    if not usable(file, info):
        raise ValueError(f"MANUAL photo for {name} is not free, or is a network photo: {file}")
    faces.crop_box(faces.fetch(file), box)
    return credit(name, file, info, box)


def pick(name: str, files: list[str], infos: dict[str, dict]) -> dict | None:
    """The first file that is free, not a network photo, and has one clear face in it."""
    for file in files:
        info = infos.get(file)
        if (
            info
            and file not in REJECT
            and usable(file, info)
            and faces.crop(faces.fetch(file)) is not None
        ):
            return credit(name, file, info)
    return None


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
        if name in MANUAL:
            out[name] = manual(name)
            print(f"{name}: {out[name]['file']} (manual)", flush=True)
            continue
        if name not in known:
            out[name] = None
            print(f"{name}: no article", flush=True)
            continue
        page, item = known[name]
        p18, lead = claim(item, "P18"), page["pageprops"].get("page_image_free")
        files = [f.replace(" ", "_") for f in (p18, lead, *depicting(item["id"])) if f]
        infos = file_info(list(dict.fromkeys(files)))
        p18 = p18 and p18.replace(" ", "_")
        tries = order(item["id"], p18, files, depicts(infos), [name, *labels(item)])
        out[name] = pick(name, tries, infos)
        print(f"{name}: {out[name]['file'] if out[name] else '-'} of {len(tries)}", flush=True)
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
