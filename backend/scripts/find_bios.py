#!/usr/bin/env python3
"""Fills fixtures/bios.json with a short Wikipedia bio for every person in fixtures/seasons/.

    cd backend
    python scripts/find_bios.py     # look up names not yet in the registry

Each name, as the fixtures spell it, maps to its article's REST summary (description and
the first sentences of the extract), the article URL for CC BY-SA attribution, and a few
Wikidata facts, or to null when no article is the person. The article is the one
find_headshots resolves: linked from a season page, or the name's own article when that
links to the show, and only when its Wikidata item is a human with that name.

A name already in the registry is never looked up again: delete its entry to retry it.
seed_season.py copies the registry into each person's catalog item.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.build_season import UA
from scripts.find_headshots import articles, claim, everyone, fixtures, get, labels

REGISTRY = Path(__file__).resolve().parents[2] / "fixtures" / "bios.json"
SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
WIKIDATA = "https://www.wikidata.org/w/api.php"
SENTENCES = 3
MAX_CHARS = 420
# A full stop after these is not the end of a sentence: "Dr. Oz", "Jr.", "U.S.".
ABBREV = re.compile(r"(\b[A-Z]|\b(?:Mr|Mrs|Ms|Dr|Jr|Sr|St|Mt|No|vs|U\.S|Inc|Ltd|Co))\.$")


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


def day(value: dict | None) -> str | None:
    """A Wikidata time as YYYY-MM-DD, YYYY-MM or YYYY, as precise as the claim is."""
    if not value:
        return None
    stamp = value["time"].lstrip("+")
    width = {11: 10, 10: 7}.get(value["precision"], 4)
    return stamp[:width] if value["precision"] >= 9 else None


def claims(item: dict, prop: str) -> list[str]:
    """Every item id a property points at, in Wikidata's order."""
    return [
        c["mainsnak"]["datavalue"]["value"]["id"]
        for c in item.get("claims", {}).get(prop, [])
        if c["mainsnak"]["snaktype"] == "value"
    ]


def facts(item: dict, names: dict[str, str]) -> dict:
    """Birth and death dates, up to three occupations and citizenship, labelled via `names`."""
    return {
        "born": day(claim(item, "P569")),
        "died": day(claim(item, "P570")),
        "occupations": [names[q] for q in claims(item, "P106") if q in names][:3],
        "nationality": [names[q] for q in claims(item, "P27") if q in names][:2],
    }


def label_names(qids: list[str]) -> dict[str, str]:
    out = {}
    for i in range(0, len(qids), 50):
        data = get(
            WIKIDATA,
            {
                "action": "wbgetentities",
                "ids": "|".join(qids[i : i + 50]),
                "props": "labels",
                "languages": "en|mul",
            },
        )
        for qid, entity in data["entities"].items():
            found = labels(entity)
            if found:
                out[qid] = found[0]
        time.sleep(0.2)
    return out


def summary(title: str) -> dict | None:
    url = SUMMARY + urllib.parse.quote(title.replace(" ", "_"), safe="")
    req = urllib.request.Request(url, headers={**UA, "Accept-Encoding": "identity"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                page = json.load(resp)
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code not in (429, 503) or attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    if page.get("type") != "standard":
        return None
    return {
        "title": page["title"],
        "url": page["content_urls"]["desktop"]["page"],
        "description": page.get("description"),
        "extract": sentences(page.get("extract") or ""),
    }


def resolve(people: dict[str, set[str]]) -> dict[str, dict | None]:
    known = articles(people)
    qids = sorted(
        {q for _, item in known.values() for p in ("P106", "P27") for q in claims(item, p)}
    )
    names = label_names(qids)
    out: dict[str, dict | None] = {}
    for name in sorted(people):
        if name not in known:
            out[name] = None
            continue
        page, item = known[name]
        bio = summary(page["title"])
        out[name] = bio and {**bio, **facts(item, names)}
        print(f"{name}: {bio['title'] if bio else '-'}", flush=True)
        time.sleep(0.1)
    return out


def main() -> None:
    registry = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    people: dict[str, set[str]] = {}
    for path in fixtures():
        season = json.loads(path.read_text())
        for p in everyone(season):
            people.setdefault(p["name"], set()).add(season["wikiTitle"])
    registry |= resolve({n: t for n, t in people.items() if n not in registry})
    REGISTRY.write_text(
        json.dumps(dict(sorted(registry.items())), indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
