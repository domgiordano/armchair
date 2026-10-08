#!/usr/bin/env python3
"""Stamps each winner-bet pick with the `released` it was sealed at, for ranked scoring.

    cd backend
    python scripts/migrate_traitors_bets.py --dry-run

Bets sealed before the bet was ranked hold `released` once, on the item; their picks
are already in rank order, so a single pick is 1st with 2nd and 3rd empty. Each pick
gets the item's `released`, conditioned on no place filled since read. Prints
how many bets each season holds by how many places are filled. Re-running is a no-op.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lambdas.common.dynamo import query_all, table
from lambdas.common.traitors_catalog import EDITIONS


def stamped(item: dict) -> list[dict] | None:
    """The item's picks each with a `released`, or None when every pick has one."""
    picks = item["picks"]
    if all("released" in p for p in picks):
        return None
    return [{**p, "released": p.get("released", item["released"])} for p in picks]


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    os.environ.setdefault("CATALOG_TABLE", "armchair-catalog")
    os.environ.setdefault("SCORES_TABLE", "armchair-scores")
    scores = table("SCORES_TABLE")

    report = {}
    for show in sorted(EDITIONS):
        for index in query_all(table("CATALOG_TABLE"), f"SEASONS#{show}"):
            bets = query_all(scores, f"WIN#{show}#{int(index['number'])}")
            if not bets:
                continue
            migrated = 0
            for b in bets:
                picks = stamped(b)
                if picks is None:
                    continue
                migrated += 1
                if not args.dry_run:
                    scores.update_item(
                        Key={"pk": b["pk"], "sk": b["sk"]},
                        UpdateExpression="SET picks = :new",
                        ConditionExpression="size(picks) = :n",
                        ExpressionAttributeValues={":new": picks, ":n": len(picks)},
                    )
            report[index["id"]] = {
                "bets": len(bets),
                "byPlaces": dict(sorted(Counter(len(b["picks"]) for b in bets).items())),
                "migrated": migrated,
            }
    print(json.dumps({"dryRun": args.dry_run, "seasons": report}, default=str))


if __name__ == "__main__":
    main()
