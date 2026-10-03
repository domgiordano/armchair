#!/usr/bin/env python3
"""Headshots for a Traitors cast: found automatically, or by image search and approved by eye.

    cd backend
    python scripts/find_traitors_headshots.py auto tus 5 --bucket traitors.armchairjudge.com
    python scripts/find_traitors_headshots.py auto tukc 2 --pageid 83087125 --bucket x --dry-run

`auto` takes each player of a season (or of every season the catalog has for the show) with
no headshot in the registry or on their catalog PLAYER, and keeps the first source with one
clear face (faces.crop):
1. Wikimedia Commons, through the player's Wikipedia article (find_headshots.commons): free, credited.
2. The player's page on the show's Fandom wiki: its main image, a network promo photo like
   DWTS's supplied ones. Fandom's HTML is behind Cloudflare; its api.php is not.
3. The network's cast page (BBC Media Centre, Peacock; common/official.py): its photo of
   the player, recorded as `source: "official"` with the page as `sourceUrl`.
4. Brave image search, only when BRAVE_API_KEY is set.
Crops go to s3://<bucket>/headshots/, into the registry, and straight onto the PLAYER and
PERSON items, since a CI run can't commit the registry.

    BRAVE_API_KEY=... python scripts/find_traitors_headshots.py search 83493607 --out /tmp/nb
    open /tmp/nb/contact.html            # note the number under each keeper
    python scripts/find_traitors_headshots.py approve /tmp/nb picks.json --bucket traitors.armchairjudge.com

picks.json maps a contestant's name to the candidate number to keep. Approved crops go
to s3://<bucket>/headshots/ and into fixtures/traitors-headshots.json (name, image,
sourceUrl), which seed_traitors_season.py puts on each PLAYER. Only that registry is in
git, never an image. Google's Custom Search API takes no new keys and shuts down
2027-01-01, so the search is Brave's image endpoint.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lambdas.common import fandom as wiki_fandom
from lambdas.common import official
from lambdas.common.dynamo import query_all
from lambdas.common.people import slug
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_gate import player_id
from lambdas.common.traitors_parse import season
from lambdas.common.wiki_fetch import USER_AGENT, latest
from scripts import faces, find_headshots
from scripts.find_headshots import get

SEARCH = "https://api.search.brave.com/res/v1/images/search"
REGISTRY = Path(__file__).resolve().parents[2] / "fixtures" / "traitors-headshots.json"
KEEP = 4
Hit = tuple[bytes, dict]


def search(query: str, key: str) -> list[dict]:
    url = f"{SEARCH}?{urllib.parse.urlencode({'q': query, 'count': 20, 'safesearch': 'strict'})}"
    req = urllib.request.Request(
        url, headers={"Accept": "application/json", "X-Subscription-Token": key}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp).get("results", [])


def download(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read()
    except OSError:
        # Hosts refuse hotlinks and time out often enough; the next candidate covers it.
        return None


def candidates(name: str, title: str, key: str, out: Path) -> list[dict]:
    """Up to KEEP crops with exactly one clear face, saved as out/<slug>/<n>.webp."""
    found = []
    folder = out / slug(name)
    folder.mkdir(parents=True, exist_ok=True)
    for r in search(f'"{name}" {title}', key):
        image = r.get("properties", {}).get("url")
        data = image and download(image)
        crop = data and faces.crop(data)
        if not crop:
            continue
        n = len(found)
        (folder / f"{n}.webp").write_bytes(crop)
        found.append(
            {"n": n, "image": image, "page": r.get("url"), "sha1": hashlib.sha1(data).hexdigest()}
        )
        if len(found) == KEEP:
            break
    return found


def commons(show: str, title: str, names: list[str]) -> dict[str, Hit]:
    people = {n: {title} for n in names}
    known = find_headshots.articles(people, (title, EDITIONS[show]["article"]))
    out = {}
    for name, (page, item) in known.items():
        shot = find_headshots.commons(name, page, item)
        if shot:
            crop = faces.crop(faces.fetch(shot["file"]))
            keep = ("image", "sourceUrl", "author", "license")
            out[name] = crop, {**{k: shot[k] for k in keep}, "source": "commons"}
    return out


def fandom(show: str, name: str) -> Hit | None:
    """The main image of the player's Fandom page, found as the bios are (common/fandom.py)."""
    page = wiki_fandom.players(show, [name]).get(name)
    file = page and page["image"]
    if not file:
        return None
    api = wiki_fandom.WIKI[show] + "/api.php"
    params = {"action": "query", "titles": f"File:{file}", "prop": "imageinfo"}
    pages = get(api, {**params, "iiprop": "url|sha1", "iiurlwidth": faces.WIDTH})["query"]["pages"]
    if not pages[0].get("imageinfo"):
        return None
    info = pages[0]["imageinfo"][0]
    data = download(info.get("thumburl") or info["url"])
    crop = data and faces.crop(data)
    if not crop:
        return None
    shot = {"image": faces.key(name, info["sha1"]), "sourceUrl": info["descriptionurl"]}
    return crop, {**shot, "source": "fandom"}


def brave(name: str, title: str, key: str) -> Hit | None:
    for r in search(f'"{name}" {title}', key):
        image = r.get("properties", {}).get("url")
        data = image and download(image)
        crop = data and faces.crop(data)
        if crop:
            shot = {"image": faces.key(name, hashlib.sha1(data).hexdigest())}
            return crop, {**shot, "sourceUrl": r.get("url") or image, "source": "search"}
    return None


def network(entry: dict | None, name: str) -> Hit | None:
    """The player's photo on the network's cast page (common/official.py)."""
    data = entry and entry["image"] and download(entry["image"])
    crop = data and faces.crop(data)
    if not crop:
        return None
    shot = {"image": faces.key(name, hashlib.sha1(data).hexdigest())}
    return crop, {**shot, "sourceUrl": entry["sourceUrl"], "source": "official"}


def resolve(show: str, number: int, title: str, names: list[str]) -> dict[str, Hit]:
    """{name: (crop, headshot)} for the names some source has a usable face for."""
    found = commons(show, title, names) if names else {}
    key = os.environ.get("BRAVE_API_KEY")
    site: dict[str, dict] | None = None
    for name in names:
        hit = found.get(name) or fandom(show, name)
        if not hit:
            # One fetch of the cast page per season, and only once a player needs it.
            site = official.cast(show, number, names, False) if site is None else site
            hit = network(site.get(name), name)
        hit = hit or (key and brave(name, title, key))
        if hit:
            found[name] = hit
        print(f"{name}: {hit[1]['source'] if hit else '-'}", flush=True)
    return found


def stamp(catalog, show: str, player: dict, shot: dict) -> None:
    """The headshot on the PLAYER, and on the PERSON rows when the people index has them."""
    pid = player_id(player)
    for pk, sk, value in [
        (player["pk"], player["sk"], shot),
        (f"PERSON#{show}#{pid}", "META", shot),
        (f"PEOPLE#{show}", f"PERSON#{pid}", shot["image"]),
    ]:
        try:
            catalog.update_item(
                Key={"pk": pk, "sk": sk},
                UpdateExpression="SET headshot = :h",
                ConditionExpression="attribute_exists(pk)",
                ExpressionAttributeValues={":h": value},
            )
        except catalog.meta.client.exceptions.ConditionalCheckFailedException:
            # No PERSON yet: discovery's people index copies the PLAYER headshot when it adds one.
            continue


def auto(
    show: str, numbers: list[int], bucket: str, dry_run: bool, pageid: int | None = None
) -> None:
    registry = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    table = os.environ.get("CATALOG_TABLE", "armchair-catalog")
    catalog = None if dry_run and pageid else boto3.resource("dynamodb").Table(table)
    for number in numbers:
        rows = query_all(catalog, f"SEASON#{show}#{number}") if catalog else []
        meta = next((r for r in rows if r["sk"] == "META"), None)
        if not pageid and not meta:
            sys.exit(f"{show} {number} is not in the catalog: seed it or pass --pageid")
        page = latest(pageid or int(meta["pageid"]))
        players = {r["name"]: r for r in rows if r["sk"].startswith("PLAYER#")}
        cast = [p["name"] for p in season(page["content"])["contestants"]]
        todo = [n for n in cast if n not in registry and not players.get(n, {}).get("headshot")]
        found = resolve(show, number, page["title"], todo)
        print(f"{show} {number}: found {len(found)} of {len(todo)} missing, {len(cast)} players")
        if dry_run:
            continue
        s3 = boto3.client("s3")
        for name, (crop, shot) in found.items():
            s3.put_object(
                Bucket=bucket,
                Key=f"headshots/{shot['image']}",
                Body=crop,
                ContentType="image/webp",
                CacheControl="public, max-age=31536000, immutable",
            )
            registry[name] = shot
        for name, player in players.items():
            if not player.get("headshot") and registry.get(name):
                stamp(catalog, show, player, registry[name])
        REGISTRY.write_text(
            json.dumps(dict(sorted(registry.items())), indent=2, ensure_ascii=False) + "\n"
        )


def numbers(show: str, which: str) -> list[int]:
    if which != "all":
        return [int(which)]
    table = boto3.resource("dynamodb").Table(os.environ.get("CATALOG_TABLE", "armchair-catalog"))
    return sorted(int(r["number"]) for r in query_all(table, f"SEASONS#{show}"))


def sheet(out: Path, found: dict[str, list[dict]]) -> None:
    rows = []
    for name, cands in found.items():
        cells = "".join(
            f'<figure><img src="{slug(name)}/{c["n"]}.webp" width="128"><figcaption>{c["n"]}</figcaption></figure>'
            for c in cands
        )
        rows.append(
            f"<section><h2>{html.escape(name)}</h2>{cells or '<p>none found</p>'}</section>"
        )
    style = "body{font:14px system-ui;background:#111;color:#eee}figure{display:inline-block;margin:4px}"
    (out / "contact.html").write_text(f"<!doctype html><style>{style}</style>{''.join(rows)}")


def approve(out: Path, picks: dict[str, int], bucket: str, dry_run: bool) -> None:
    found = json.loads((out / "candidates.json").read_text())
    registry = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    s3 = boto3.client("s3")
    for name, n in sorted(picks.items()):
        c = next(c for c in found[name] if c["n"] == n)
        image = faces.key(name, c["sha1"])
        print(f"{name} #{n} -> s3://{bucket}/headshots/{image}")
        if not dry_run:
            s3.put_object(
                Bucket=bucket,
                Key=f"headshots/{image}",
                Body=(out / slug(name) / f"{n}.webp").read_bytes(),
                ContentType="image/webp",
                CacheControl="public, max-age=31536000, immutable",
            )
        registry[name] = {"image": image, "sourceUrl": c["page"] or c["image"], "source": "search"}
    if not dry_run:
        REGISTRY.write_text(
            json.dumps(dict(sorted(registry.items())), indent=2, ensure_ascii=False) + "\n"
        )


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("pageid", type=int)
    s.add_argument("--out", type=Path, required=True)
    a = sub.add_parser("approve")
    a.add_argument("out", type=Path)
    a.add_argument("picks", type=Path)
    a.add_argument("--bucket", required=True)
    a.add_argument("--dry-run", action="store_true")
    u = sub.add_parser("auto")
    u.add_argument("show", choices=sorted(EDITIONS))
    u.add_argument("season", help="a season number, or all of the show's in the catalog")
    u.add_argument("--bucket", required=True)
    u.add_argument("--pageid", type=int, help="the season's Wikipedia page id, for one season")
    u.add_argument("--dry-run", action="store_true", help="find only: no upload, no writes")
    args = ap.parse_args(argv)

    if args.cmd == "auto":
        if args.pageid and args.season == "all":
            sys.exit("--pageid is for one season")
        auto(args.show, numbers(args.show, args.season), args.bucket, args.dry_run, args.pageid)
        return
    if args.cmd == "approve":
        approve(args.out, json.loads(args.picks.read_text()), args.bucket, args.dry_run)
        return
    key = os.environ.get("BRAVE_API_KEY") or sys.exit("BRAVE_API_KEY is not set")
    args.out.mkdir(parents=True, exist_ok=True)
    page = latest(args.pageid)
    registry = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    names = [p["name"] for p in season(page["content"])["contestants"] if p["name"] not in registry]
    found = {name: candidates(name, "The Traitors", key, args.out) for name in names}
    (args.out / "candidates.json").write_text(json.dumps(found, indent=2))
    sheet(args.out, found)
    print(f"{len(names)} searched, {sum(1 for c in found.values() if not c)} with nothing usable")
    print(args.out / "contact.html")


if __name__ == "__main__":
    main()
