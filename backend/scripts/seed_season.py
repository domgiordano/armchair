#!/usr/bin/env python3
"""Seeds one season's `catalog` items from fixtures/seasons/<season>.json.

    cd backend
    python scripts/seed_season.py --dry-run                  # print the items, write nothing
    python scripts/seed_season.py                            # write armchair-catalog
    python scripts/seed_season.py all                        # every fixture, past seasons too
    python scripts/seed_season.py --headshots <site-bucket>  # also copy headshots from Commons
    python scripts/seed_season.py --credits                  # refresh credits in the JSON, then stop

A finished season's fixture carries its performances: they go to armchair-performances
through the poller's publish() with every judge's value confirmed, then each episode's
results. The SEASONS#<show> partition lists every season for the season picker; the one
fixture with `current: true` is the default.

Writes with the default AWS credentials. Re-running is safe: see write() and publish().
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from decimal import Decimal
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("CATALOG_TABLE", "armchair-catalog")
os.environ.setdefault("PERFORMANCES_TABLE", "armchair-performances")

from lambdas.common.keywords import keywords
from lambdas.cron_poll_wiki.handler import publish

SEASONS = Path(__file__).resolve().parents[2] / "fixtures" / "seasons"
UA = {"User-Agent": "armchair/0.1 (https://github.com/domgiordano/armchair)"}
COMMONS = "https://commons.wikimedia.org"
# The poller and admin endpoints own these once the season is running, so a re-seed
# only fills them in when absent. keywordOverride and results are never written here.
LATER_OWNED = {"panel", "dancesPerCouple", "eliminatedEp"}


def items(season: dict) -> list[dict]:
    pk = f"SEASON#{season['show']}#{season['season']}"
    celebs = {
        c["id"]: next(m["name"] for m in c["members"] if m["role"] == "celebrity")
        for c in season["contestants"]
    }
    derived = keywords(celebs)
    rows = [
        {
            "pk": pk,
            "sk": "META",
            "wikiTitle": season["wikiTitle"],
            "timezone": season["timezone"],
            "defaultPanel": season["defaultPanel"],
            **{k: season[k] for k in ("year", "current", "revid") if k in season},
        },
        {
            "pk": f"SEASONS#{season['show']}",
            "sk": f"SEASON#{season['season']:03d}",
            "id": f"{season['show']}-{season['season']}",
            "number": season["season"],
            "year": season["year"],
            "current": season["current"],
        },
    ]
    rows += [
        {
            "pk": pk,
            "sk": f"EP#{e['ep']:02d}",
            **{k: v for k, v in e.items() if k not in ("ep", "performances")},
        }
        for e in season["episodes"]
    ]
    rows += [
        {"pk": pk, "sk": f"JUDGE#{j['id']}", **{k: v for k, v in j.items() if k != "id"}}
        for j in season["judges"]
    ]
    rows += [
        {
            "pk": pk,
            "sk": f"CONTESTANT#{c['id']}",
            **{k: v for k, v in c.items() if k != "id"},
            "keyword": derived[c["id"]],
        }
        for c in season["contestants"]
    ]
    return rows


def write(table, rows: list[dict]) -> None:
    """Updates rather than puts, so attributes written by other code survive a re-seed."""
    for row in rows:
        attrs = {k: v for k, v in row.items() if k not in ("pk", "sk")}
        sets = [
            f"#a{i} = if_not_exists(#a{i}, :a{i})" if k in LATER_OWNED else f"#a{i} = :a{i}"
            for i, k in enumerate(attrs)
        ]
        table.update_item(
            Key={"pk": row["pk"], "sk": row["sk"]},
            UpdateExpression="SET " + ", ".join(sets),
            ExpressionAttributeNames={f"#a{i}": k for i, k in enumerate(attrs)},
            ExpressionAttributeValues={f":a{i}": v for i, v in enumerate(attrs.values())},
        )


def publish_all(season: dict) -> int:
    """Every performance and result in a finished season's fixture, confirmed at once."""
    ref = (season["show"], season["season"])
    t = int(time.time())
    count = 0
    for e in season["episodes"]:
        if "performances" not in e:
            continue
        perfs = [{"panel": e["panel"], **p} for p in e["performances"]]
        out = [c["id"] for c in season["contestants"] if c.get("eliminatedEp") == e["ep"]]
        episode = {"sk": f"EP#{e['ep']:02d}", "panel": e["panel"]}
        publish(episode, e["panel"], perfs, season["revid"], t, 0, season=ref, settled=out)
        count += len(perfs)
    return count


def headshots(season: dict) -> list[dict]:
    people = [m for c in season["contestants"] for m in c["members"]] + season["judges"]
    return [p["headshot"] for p in people if p["headshot"]]


def upload(shots: list[dict], bucket: str, dry_run: bool) -> None:
    """Copies a 400px Commons thumbnail of each file to s3://bucket/headshots/<file>."""
    s3 = boto3.client("s3")
    for shot in shots:
        src = f"{COMMONS}/wiki/Special:FilePath/{urllib.parse.quote(shot['file'])}?width=400"
        key = f"headshots/{shot['file']}"
        print(f"{src} -> s3://{bucket}/{key}")
        if dry_run:
            continue
        with urllib.request.urlopen(urllib.request.Request(src, headers=UA), timeout=30) as resp:
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=resp.read(),
                ContentType=resp.headers["Content-Type"],
                CacheControl="public, max-age=86400",
            )


def credits(path: Path) -> None:
    """Rewrites author, license and sourceUrl of every headshot from Commons file metadata."""
    season = json.loads(path.read_text())
    shots = headshots(season)
    pages = {}
    for i in range(0, len(shots), 50):
        query = urllib.parse.urlencode(
            {
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "url|extmetadata",
                "titles": "|".join(f"File:{s['file']}" for s in shots[i : i + 50]),
                "format": "json",
                "formatversion": 2,
            }
        )
        req = urllib.request.Request(f"{COMMONS}/w/api.php?{query}", headers=UA)
        with urllib.request.urlopen(req, timeout=30) as resp:
            pages |= {p["title"]: p for p in json.load(resp)["query"]["pages"]}

    for shot in shots:
        page = pages[f"File:{shot['file'].replace('_', ' ')}"]
        if "imageinfo" not in page:
            raise SystemExit(f"{shot['file']} is not on Commons")
        info = page["imageinfo"][0]
        artist = html.unescape(re.sub(r"<[^>]+>", "", info["extmetadata"]["Artist"]["value"]))
        shot["author"] = " ".join(artist.split())
        shot["license"] = info["extmetadata"]["LicenseShortName"]["value"]
        shot["sourceUrl"] = info["descriptionurl"]
    path.write_text(json.dumps(season, indent=2, ensure_ascii=False) + "\n")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="seed_season")
    parser.add_argument(
        "season", nargs="?", default="dwts-35", help="fixtures/seasons/ file stem, or all"
    )
    parser.add_argument("--dry-run", action="store_true", help="print, write nothing")
    parser.add_argument("--headshots", metavar="BUCKET", help="copy headshots to BUCKET")
    parser.add_argument("--credits", action="store_true", help="refresh credits from Commons")
    args = parser.parse_args(argv)
    paths = (
        sorted(SEASONS.glob("*.json"))
        if args.season == "all"
        else [SEASONS / f"{args.season}.json"]
    )

    if args.credits:
        for path in paths:
            credits(path)
        return

    for path in paths:
        # Scores as Decimal: DynamoDB takes no floats, and half points are real (S15).
        season = json.loads(path.read_text(), parse_float=Decimal)
        rows = items(season)
        if args.dry_run:
            print(json.dumps(rows, indent=2, ensure_ascii=False, default=str))
        else:
            write(boto3.resource("dynamodb").Table(os.environ["CATALOG_TABLE"]), rows)
            dances = publish_all(season)
            print(f"{path.stem}: {len(rows)} catalog items, {dances} performances")
        if args.headshots:
            upload(headshots(season), args.headshots, args.dry_run)


if __name__ == "__main__":
    main()
