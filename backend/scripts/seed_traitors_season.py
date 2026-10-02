#!/usr/bin/env python3
"""Seeds one Traitors season's `catalog` items from its live Wikipedia page.

    cd backend
    python scripts/seed_traitors_season.py tus 5 83493607 --current --dry-run
    python scripts/seed_traitors_season.py tukc 2 83087125 --current --open-at 2026-10-15T00:00:00Z

Episodes released before --open-at are closed: results showing, no picks. Without it a
first seed opens the season now and a re-seed keeps whatever openAt it already has.
Results, factions and exits are the poller's to write, never this script's.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lambdas.common.catalog_dynamo import write
from lambdas.common.traitors_catalog import EDITIONS, items
from lambdas.common.traitors_parse import season
from lambdas.common.wiki_fetch import latest


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("show", choices=sorted(EDITIONS))
    ap.add_argument("season", type=int)
    ap.add_argument("pageid", type=int)
    ap.add_argument("--current", action="store_true")
    ap.add_argument("--open-at", help="UTC, e.g. 2026-10-15T00:00:00Z")
    ap.add_argument("--release-time", help="local HH:MM, overriding the edition default")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    page = latest(args.pageid)
    parsed = season(page["content"])
    if not parsed["contestants"] or not parsed["episodes"]:
        sys.exit(f"{page['title']} rev {page['revid']}: no cast or episode table, not seeding")

    rows = items(
        args.show,
        args.season,
        {"pageid": args.pageid, "title": page["title"]},
        parsed,
        current=args.current,
        open_at=args.open_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        release_time=args.release_time,
    )
    if args.dry_run:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return
    table = boto3.resource("dynamodb").Table(os.environ.get("CATALOG_TABLE", "armchair-catalog"))
    write(table, rows, keep=set() if args.open_at else {"openAt"})
    print(f"{page['title']} rev {page['revid']}: {len(rows)} items")


if __name__ == "__main__":
    main()
