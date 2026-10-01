"""
People across seasons: celebrities, pros and judges, keyed by a name slug.

seed_season.py writes the index into armchair-catalog:

    PERSON#{show}#{id}  META          name, roles, headshot, seasons, bio, facts
    PEOPLE#{show}       PERSON#{id}   name, roles, headshot file, season numbers

A celebrity's id is their contestant id; a pro's is the slug of their name, the
same rule build_season.py uses for contestant ids and judge ids, so one person
who danced and later judged is one id.
"""

from __future__ import annotations

import re
import unicodedata


def slug(name: str) -> str:
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower().replace("'", "")).strip("-")
