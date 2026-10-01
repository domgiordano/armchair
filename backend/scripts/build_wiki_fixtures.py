"""Writes fixtures/wiki-golden.json from the hand-transcribed expectations below.

Run from anywhere: python3 backend/scripts/build_wiki_fixtures.py

Every expected value was read off the committed wikitext by eye. Nothing here calls the
parser, so a wrong parser can't write its own answer key.
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "fixtures" / "wiki-golden.json"

S35_ALIASES = {
    "Amber": "amber-glenn",
    "Ciara": "ciara-miller",
    "Conner L.": "conner-leavitt",
    "Connor": "connor-wood",
    "Connor W.": "connor-wood",
    "Ezra": "ezra-frech",
    "Giada": "giada-de-laurentiis",
    "Guillermo": "guillermo-rodriguez",
    "Harry": "harry-shum-jr",
    "Jackson": "jackson-olson",
    "Jenna": "jenna-dewan",
    "Julia": "julia-stiles",
    "Maura": "maura-higgins",
    "Sarah Jane": "sarah-jane-nader",
    "Tatyana": "tatyana-ali",
    "Taylor": "taylor-hanson",
    "Tyler": "tyler-cameron",
}
S34_ALIASES = {
    name: name.lower()
    for name in [
        "Alix",
        "Andy",
        "Baron",
        "Corey",
        "Danielle",
        "Dylan",
        "Elaine",
        "Hilaria",
        "Jen",
        "Jordan",
        "Lauren",
        "Robert",
        "Scott",
        "Whitney",
    ]
}

S1_ALIASES = {
    name: name.lower() for name in ["Evander", "Joey", "John", "Kelly", "Rachel", "Trista"]
}
S8_ALIASES = {
    name: name.lower().replace("'", "").replace(" ", "-")
    for name in [
        "Belinda",
        "Chuck",
        "David",
        "Denise",
        "Gilles",
        "Holly",
        "Lawrence",
        "Lil' Kim",
        "Melissa",
        "Shawn",
        "Steve",
        "Steve-O",
        "Ty",
    ]
}
S15_ALIASES = {
    name: name.lower()
    for name in ["Apolo", "Emmitt", "Gilles", "Kelly", "Kirstie", "Melissa", "Shawn"]
}
S20_ALIASES = {name: name.lower() for name in ["Nastia", "Noah", "Riker", "Rumer"]}
S31_ALIASES = {
    name: name.lower()
    for name in [
        "Charli",
        "Daniel",
        "Gabby",
        "Heidi",
        "Jessie",
        "Jordin",
        "Shangela",
        "Trevor",
        "Vinny",
        "Wayne",
    ]
}

MAIN = ["Carrie Ann Inaba", "Derek Hough", "Bruno Tonioli"]
CLASSIC = ["Carrie Ann Inaba", "Len Goodman", "Bruno Tonioli"]


def perf(cid, total, judges, n=1, night=1, bonus=None):
    judges = [None if v == "X" else v for v in judges]
    return {
        "night": night,
        "contestants": [cid],
        "n": n,
        "rateable": True,
        "total": total,
        "judges": list(judges),
        "bonus": bonus,
    }


def team(cids, total, judges):
    return {
        "night": 1,
        "contestants": cids,
        "n": 1,
        "rateable": True,
        "total": total,
        "judges": list(judges),
        "bonus": None,
    }


def empty(cid):
    return {
        "night": 1,
        "contestants": [cid],
        "n": 1,
        "rateable": True,
        "total": None,
        "judges": None,
        "bonus": None,
    }


def week(n, panel, performances, unscored=(), panels=None):
    """Every table in these weeks is scored by the week's panel unless `panels` says per night."""
    for p in performances:
        p["panel"] = (panels or {}).get(p["night"], panel)
    return {
        "week": n,
        "panel": panel,
        "performances": performances,
        "rejected": [],
        "unscored": list(unscored),
    }


# The first nine S35 week 3 dances are identical in the final, vandal and revert revisions.
S35_WK3_FIRST_NINE = [
    perf("amber-glenn", 24, (8, 8, 8)),
    perf("julia-stiles", 19, (6, 7, 6)),
    perf("guillermo-rodriguez", 15, (5, 5, 5)),
    perf("tatyana-ali", 21, (7, 7, 7)),
    perf("harry-shum-jr", 24, (8, 8, 8)),
    perf("taylor-hanson", 18, (6, 6, 6)),
    perf("maura-higgins", 22, (7, 7, 8)),
    perf("ciara-miller", 18, (6, 6, 6)),
    perf("jackson-olson", 18, (6, 6, 6)),
]

CASES = [
    {
        "name": "S35 week 1: two nights, Conner L. / Connor W.",
        "fixture": "s35-1377681547.wikitext",
        "aliases": "s35",
        "expected": week(
            1,
            MAIN,
            [
                perf("jackson-olson", 15, (5, 5, 5)),
                perf("tyler-cameron", 17, (6, 5, 6)),
                perf("conner-leavitt", 12, (4, 4, 4)),
                perf("guillermo-rodriguez", 10, (4, 3, 3)),
                perf("ezra-frech", 20, (7, 6, 7)),
                perf("connor-wood", 16, (6, 5, 5)),
                perf("taylor-hanson", 16, (6, 5, 5)),
                perf("harry-shum-jr", 21, (7, 7, 7)),
                perf("tatyana-ali", 12, (4, 4, 4), night=2),
                perf("amber-glenn", 18, (6, 6, 6), night=2),
                perf("ciara-miller", 15, (5, 5, 5), night=2),
                perf("giada-de-laurentiis", 16, (6, 5, 5), night=2),
                perf("julia-stiles", 18, (6, 6, 6), night=2),
                perf("maura-higgins", 21, (7, 7, 7), night=2),
                perf("sarah-jane-nader", 14, (5, 4, 5), night=2),
                perf("jenna-dewan", 19, (6, 6, 7), night=2),
            ],
        ),
    },
    {
        "name": "S35 week 2 final",
        "fixture": "s35-1377681547.wikitext",
        "aliases": "s35",
        "expected": week(
            2,
            MAIN,
            [
                perf("jenna-dewan", 21, (7, 7, 7)),
                perf("ciara-miller", 18, (6, 6, 6)),
                perf("tyler-cameron", 16, (6, 5, 5)),
                perf("julia-stiles", 16, (5, 6, 5)),
                perf("jackson-olson", 18, (6, 6, 6)),
                perf("giada-de-laurentiis", 12, (4, 4, 4)),
                perf("connor-wood", 15, (5, 5, 5)),
                perf("ezra-frech", 21, (7, 7, 7)),
                perf("tatyana-ali", 18, (6, 6, 6)),
                perf("amber-glenn", 21, (7, 7, 7)),
                perf("guillermo-rodriguez", 12, (4, 4, 4)),
                perf("taylor-hanson", 15, (5, 5, 5)),
                perf("harry-shum-jr", 18, (6, 6, 6)),
                perf("maura-higgins", 19, (6, 6, 7)),
            ],
        ),
    },
    {
        "name": "S35 week 3 final",
        "fixture": "s35-1377681547.wikitext",
        "aliases": "s35",
        "expected": week(
            3,
            MAIN,
            S35_WK3_FIRST_NINE
            + [
                perf("connor-wood", 20, (7, 6, 7)),
                perf("jenna-dewan", 21, (7, 7, 7)),
                perf("tyler-cameron", 17, (5, 6, 6)),
                perf("ezra-frech", 21, (7, 7, 7)),
            ],
        ),
    },
    {
        # Both vandal values pass the sanity checks; only the confirm window can reject them.
        "name": "S35 week 3 vandal revision: Jenna & Val 30, Connor's judges swapped",
        "fixture": "s35-1377570871-vandal.wikitext",
        "aliases": "s35",
        "expected": week(
            3,
            MAIN,
            S35_WK3_FIRST_NINE
            + [
                perf("connor-wood", 20, (7, 7, 6)),
                perf("jenna-dewan", 30, (10, 10, 10)),
                empty("tyler-cameron"),
                empty("ezra-frech"),
            ],
        ),
    },
    {
        "name": "S35 week 3 revert of the vandal edit, mid-show",
        "fixture": "s35-1377571301-revert.wikitext",
        "aliases": "s35",
        "expected": week(
            3,
            MAIN,
            S35_WK3_FIRST_NINE
            + [
                empty("connor-wood"),
                empty("jenna-dewan"),
                empty("tyler-cameron"),
                empty("ezra-frech"),
            ],
        ),
    },
    {
        "name": "S35 week 4 pre-show alphabetical table, empty cells",
        "fixture": "s35-1377681547.wikitext",
        "aliases": "s35",
        "expected": week(
            4,
            MAIN,
            [
                empty("amber-glenn"),
                empty("ciara-miller"),
                empty("connor-wood"),
                empty("ezra-frech"),
                empty("guillermo-rodriguez"),
                empty("harry-shum-jr"),
                empty("jackson-olson"),
                empty("jenna-dewan"),
                empty("julia-stiles"),
                empty("maura-higgins"),
                empty("tatyana-ali"),
                empty("tyler-cameron"),
            ],
        ),
    },
    {
        "name": "S34 week 1: judge absent, 2-judge panel, efn in a score cell",
        "fixture": "s34-1375977389.wikitext",
        "aliases": "s34",
        "expected": week(
            1,
            ["Derek Hough", "Bruno Tonioli"],
            [
                perf("jordan", 10, (5, 5)),
                perf("dylan", 10, (5, 5)),
                perf("elaine", 12, (6, 6)),
                perf("whitney", 15, (7, 8)),
                perf("baron", 10, (5, 5)),
                perf("alix", 13, (7, 6)),
                perf("scott", 10, (5, 5)),
                perf("danielle", 12, (6, 6)),
                perf("jen", 12, (6, 6)),
                perf("corey", 9, (4, 5)),
                perf("lauren", 13, (7, 6)),
                perf("andy", 9, (5, 4)),
                perf("hilaria", 14, (7, 7)),
                perf("robert", 15, (8, 7)),
            ],
        ),
    },
    {
        "name": "S34 week 7: guest judge, marathon bonus rows, rehearsal-footage score",
        "fixture": "s34-1375977389.wikitext",
        "aliases": "s34",
        "expected": week(
            7,
            ["Carrie Ann Inaba", "Derek Hough", "Cheryl Burke", "Bruno Tonioli"],
            [
                perf("whitney", 37, (9, 9, 9, 10), bonus=5),
                perf("jordan", 34, (9, 8, 8, 9), bonus=4),
                perf("andy", 28, (7, 7, 7, 7), bonus=1),
                perf("elaine", 32, (8, 8, 8, 8), bonus=0),
                perf("danielle", 33, (8, 8, 8, 9), bonus=2),
                perf("robert", 38, (10, 9, 9, 10), bonus=3),
                perf("jen", 32, (8, 8, 8, 8), bonus=2),
                perf("alix", 39, (10, 10, 9, 10), bonus=4),
                perf("dylan", 35, (9, 9, 8, 9), bonus=3),
            ],
        ),
    },
    {
        "name": "S34 week 8: team dances with hosts, efn nested in nowrap",
        "fixture": "s34-1375977389.wikitext",
        "aliases": "s34",
        "expected": week(
            8,
            ["Carrie Ann Inaba", "Derek Hough", "Flavor Flav", "Bruno Tonioli"],
            [
                perf("dylan", 36, (8, 9, 10, 9)),
                perf("alix", 39, (10, 10, 9, 10)),
                perf("andy", 30, (7, 7, 9, 7)),
                perf("whitney", 39, (9, 10, 10, 10)),
                perf("danielle", 34, (9, 8, 9, 8)),
                perf("elaine", 37, (9, 9, 10, 9)),
                perf("jordan", 38, (10, 9, 10, 9)),
                perf("robert", 38, (9, 9, 10, 10)),
                team(["danielle", "whitney", "jordan", "dylan"], 40, (10, 10, 10, 10)),
                team(["andy", "robert", "alix", "elaine"], 38, (9, 10, 10, 9)),
            ],
        ),
    },
    {
        "name": "S34 week 9: 4 judges, relay table without scores ignored",
        "fixture": "s34-1375977389.wikitext",
        "aliases": "s34",
        "expected": week(
            9,
            ["Carrie Ann Inaba", "Derek Hough", "Tom Bergeron", "Bruno Tonioli"],
            [
                perf("elaine", 36, (9, 9, 9, 9)),
                perf("robert", 40, (10, 10, 10, 10)),
                perf("andy", 29, (8, 7, 7, 7)),
                perf("dylan", 40, (10, 10, 10, 10)),
                perf("jordan", 37, (9, 10, 9, 9)),
                perf("alix", 40, (10, 10, 10, 10)),
                perf("whitney", 40, (10, 10, 10, 10)),
            ],
        ),
    },
    {
        "name": "S34 week 10: two dances per couple via rowspan",
        "fixture": "s34-1375977389.wikitext",
        "aliases": "s34",
        "expected": week(
            10,
            MAIN,
            [
                perf("elaine", 27, (9, 9, 9)),
                perf("elaine", 30, (10, 10, 10), n=2),
                perf("alix", 28, (9, 10, 9)),
                perf("alix", 30, (10, 10, 10), n=2),
                perf("whitney", 29, (9, 10, 10)),
                perf("whitney", 29, (9, 10, 10), n=2),
                perf("dylan", 27, (9, 9, 9)),
                perf("dylan", 28, (9, 9, 10), n=2),
                perf("jordan", 27, (9, 9, 9)),
                perf("jordan", 30, (10, 10, 10), n=2),
                perf("robert", 30, (10, 10, 10)),
                perf("robert", 29, (10, 9, 10), n=2),
            ],
        ),
    },
    {
        "name": "S34 week 11: Judge column before Scores, three dances per couple",
        "fixture": "s34-1375977389.wikitext",
        "aliases": "s34",
        "expected": week(
            11,
            MAIN,
            [
                perf("alix", 30, (10, 10, 10)),
                perf("alix", 30, (10, 10, 10), n=2),
                perf("alix", 30, (10, 10, 10), n=3),
                perf("dylan", 28, (9, 9, 10)),
                perf("dylan", 30, (10, 10, 10), n=2),
                perf("dylan", 30, (10, 10, 10), n=3),
                perf("elaine", 30, (10, 10, 10)),
                perf("elaine", 27, (9, 9, 9), n=2),
                perf("elaine", 30, (10, 10, 10), n=3),
                perf("robert", 29, (9, 10, 10)),
                perf("robert", 30, (10, 10, 10), n=2),
                perf("robert", 30, (10, 10, 10), n=3),
                perf("jordan", 29, (9, 10, 10)),
                perf("jordan", 30, (10, 10, 10), n=2),
                perf("jordan", 30, (10, 10, 10), n=3),
            ],
        ),
    },
    {
        "name": "S1 week 4: group dance marked No scores received",
        "fixture": "s1-1375742773.wikitext",
        "aliases": "s1",
        "expected": week(
            4,
            CLASSIC,
            [
                perf("joey", 20, (7, 6, 7)),
                perf("rachel", 25, (7, 9, 9)),
                perf("john", 21, (7, 8, 6)),
                perf("kelly", 26, (9, 9, 8)),
            ],
            unscored=[
                {
                    "night": 1,
                    "row": "Joey & Ashly\nJohn & Charlotte\nKelly & Alec\nRachel & Jonathan",
                }
            ],
        ),
    },
    {
        "name": "S8 week 3: scored dance-off on the results show is night 2",
        "fixture": "s8-1372835313.wikitext",
        "aliases": "s8",
        "expected": week(
            3,
            CLASSIC,
            [
                perf("denise", 16, (5, 6, 5)),
                perf("chuck", 23, (8, 7, 8)),
                perf("holly", 17, (5, 6, 6)),
                perf("steve-o", 15, (5, 5, 5)),
                perf("lawrence", 20, (7, 6, 7)),
                perf("shawn", 27, (9, 9, 9)),
                perf("gilles", 27, (9, 9, 9)),
                perf("david", 24, (8, 8, 8)),
                perf("steve", 10, (4, 3, 3)),
                perf("melissa", 27, (9, 9, 9)),
                perf("lil-kim", 25, (8, 8, 9)),
                perf("ty", 23, (8, 8, 7)),
                perf("holly", 18, (6, 6, 6), n=2, night=2),
                perf("denise", 20, (6, 7, 7), n=2, night=2),
            ],
        ),
    },
    {
        "name": "S15 week 7: a column per judge, half points, swing marathon bonus",
        "fixture": "s15-1372836123.wikitext",
        "aliases": "s15",
        "expected": week(
            7,
            ["Inaba", "Goodman", "Tonioli"],
            [
                perf("apolo", 27, (9, 9, 9), bonus=6),
                perf("emmitt", 27.5, (8.5, 9.5, 9.5), bonus=7),
                perf("kirstie", 24, (8, 8, 8), bonus=4),
                perf("kelly", 27, (9, 9, 9), bonus=9),
                perf("melissa", 29, (10, 9.5, 9.5), bonus=10),
                perf("shawn", 30, (10, 10, 10), bonus=8),
                perf("gilles", 28.5, (9.5, 9.5, 9.5), bonus=5),
            ],
        ),
    },
    {
        "name": "S20 week 9: X where a judge sat out the couple they coached",
        "fixture": "s20-1375764332.wikitext",
        "aliases": "s20",
        "expected": week(
            9,
            ["Carrie Ann Inaba", "Len Goodman", "Julianne Hough", "Bruno Tonioli"],
            [
                perf("rumer", 38, (10, 9, 9, 10)),
                perf("rumer", 30, (10, 10, 10, "X"), n=2),
                perf("noah", 36, (9, 9, 9, 9)),
                perf("noah", 30, ("X", 10, 10, 10), n=2),
                perf("riker", 40, (10, 10, 10, 10)),
                perf("riker", 30, (10, 10, "X", 10), n=2),
                perf("nastia", 40, (10, 10, 10, 10)),
                perf("nastia", 30, (10, "X", 10, 10), n=2),
            ],
        ),
    },
    {
        "name": "S31 week 6: five judges, order line reads given in this order",
        "fixture": "s31-1372832846.wikitext",
        "aliases": "s31",
        "expected": week(
            6,
            ["Carrie Ann Inaba", "Len Goodman", "Michael Bublé", "Derek Hough", "Bruno Tonioli"],
            [
                perf("shangela", 45, (9, 9, 9, 9, 9)),
                perf("trevor", 42, (9, 8, 8, 8, 9)),
                perf("gabby", 46, (9, 9, 9, 9, 10)),
                perf("vinny", 36, (7, 7, 8, 7, 7)),
                perf("jordin", 43, (9, 8, 9, 8, 9)),
                perf("charli", 50, (10, 10, 10, 10, 10)),
                perf("heidi", 46, (9, 9, 10, 9, 9)),
                perf("wayne", 44, (8, 9, 10, 8, 9)),
                perf("jessie", 41, (8, 8, 9, 8, 8)),
                perf("daniel", 43, (9, 8, 9, 8, 9)),
            ],
        ),
    },
]


def main():
    fixture = {
        "$comment": [
            "Golden output for backend/lambdas/common/wiki_parse.py, read by backend/tests/test_wiki_parse.py.",
            "Built by backend/scripts/build_wiki_fixtures.py from hand-transcribed values, never from the parser.",
            "Wikitext sources and CC BY-SA 4.0 attribution: fixtures/wiki/README.md.",
        ],
        "aliases": {
            "s35": S35_ALIASES,
            "s34": S34_ALIASES,
            "s1": S1_ALIASES,
            "s8": S8_ALIASES,
            "s15": S15_ALIASES,
            "s20": S20_ALIASES,
            "s31": S31_ALIASES,
        },
        "cases": CASES,
    }
    OUT.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"wrote {len(CASES)} cases to {OUT}")


if __name__ == "__main__":
    main()
