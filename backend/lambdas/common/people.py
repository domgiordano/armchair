"""
People across seasons: celebrities, pros and judges, keyed by a name slug.

seed_season.py writes the index into armchair-catalog:

    PERSON#{show}#{id}  META          name, roles, headshot, seasons, bio, facts
    PEOPLE#{show}       PERSON#{id}   name, roles, headshot image, season numbers

A celebrity's id is their contestant id; a pro's is the slug of their name, the
same rule build_season.py uses for contestant ids and judge ids, so one person
who danced and later judged is one id.
"""

from __future__ import annotations

import re
import unicodedata

from lambdas.common.dynamo import query_all, table


def slug(name: str) -> str:
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower().replace("'", "")).strip("-")


def fold(text: str) -> str:
    """Lowercase, accents and apostrophes off, one space between words: "Śliwińska" finds "sliw"."""
    ascii_ = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join(ascii_.replace("'", "").casefold().split())


def rank(name: str, q: str) -> int | None:
    """0 when the name starts with `q` (folded), 1 when a word in it does, 2 when it holds it."""
    name = fold(name)
    if name.startswith(q):
        return 0
    if any(w.startswith(q) for w in name.split()):
        return 1
    return 2 if q in name else None


def index(show: str) -> list[dict]:
    """Every PEOPLE row of the show: about 500 small items, one Query."""
    return query_all(table("CATALOG_TABLE"), f"PEOPLE#{show}")


def person(show: str, pid: str) -> dict | None:
    return (
        table("CATALOG_TABLE")
        .get_item(Key={"pk": f"PERSON#{show}#{pid}", "sk": "META"})
        .get("Item")
    )
