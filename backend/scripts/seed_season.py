#!/usr/bin/env python3
"""Seeds one season's `catalog` items from fixtures/seasons/<season>.json.

    cd backend
    python scripts/seed_season.py --dry-run                  # print the items, write nothing
    python scripts/seed_season.py                            # write armchair-catalog
    python scripts/seed_season.py all                        # every fixture, past seasons too
    python scripts/seed_season.py all --headshots <bucket>   # also crop missing headshots from Commons

A finished season's fixture carries its performances: they go to armchair-performances
through the poller's publish() with every judge's value confirmed, then each episode's
results. The SEASONS#<show> partition lists every season for the season picker; the one
fixture with `current: true` is the default.

Writes with the default AWS credentials. Re-running is safe: see write() and publish().
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from decimal import Decimal
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("CATALOG_TABLE", "armchair-catalog")
os.environ.setdefault("PERFORMANCES_TABLE", "armchair-performances")

from lambdas.common.keywords import keywords
from lambdas.cron_poll_wiki.handler import publish
from scripts import faces

SEASONS = Path(__file__).resolve().parents[2] / "fixtures" / "seasons"
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
    """Crops each headshot not yet at s3://bucket/headshots/<image> from its Commons photo.

    Keys are content-hashed (faces.key), so the year-long cache never serves a replaced
    photo. A photo the cropper finds no face in is left out, and the run fails naming it:
    the site shows initials for it until the registry drops or replaces it.
    """
    s3 = boto3.client("s3")
    pages = s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="headshots/")
    have = {o["Key"] for page in pages for o in page.get("Contents", [])}
    skipped = 0
    faceless = []
    for shot in sorted({s["image"]: s for s in shots}.values(), key=lambda s: s["image"]):
        key = f"headshots/{shot['image']}"
        if key in have:
            skipped += 1
            continue
        print(f"{shot['file']} -> s3://{bucket}/{key}")
        if dry_run:
            continue
        body = faces.crop(faces.fetch(shot["file"]))
        if body is None:
            faceless.append(shot["file"])
            continue
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000, immutable",
        )
        time.sleep(0.2)
    print(f"headshots: {skipped} already in the bucket")
    if faceless:
        sys.exit(f"headshots with no face found, not uploaded: {', '.join(faceless)}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="seed_season")
    parser.add_argument(
        "season", nargs="?", default="dwts-35", help="fixtures/seasons/ file stem, or all"
    )
    parser.add_argument("--dry-run", action="store_true", help="print, write nothing")
    parser.add_argument("--headshots", metavar="BUCKET", help="copy headshots to BUCKET")
    args = parser.parse_args(argv)
    paths = (
        sorted(SEASONS.glob("*.json"))
        if args.season == "all"
        else [SEASONS / f"{args.season}.json"]
    )

    shots = []
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
        shots += headshots(season)
    if args.headshots:
        upload(shots, args.headshots, args.dry_run)


if __name__ == "__main__":
    main()
