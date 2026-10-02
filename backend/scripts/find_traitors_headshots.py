#!/usr/bin/env python3
"""Headshots for a Traitors cast, found by image search and approved by eye.

    cd backend
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

from lambdas.common.people import slug
from lambdas.common.traitors_parse import season
from lambdas.common.wiki_fetch import USER_AGENT, latest
from scripts import faces

SEARCH = "https://api.search.brave.com/res/v1/images/search"
REGISTRY = Path(__file__).resolve().parents[2] / "fixtures" / "traitors-headshots.json"
KEEP = 4


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
    args = ap.parse_args(argv)

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
