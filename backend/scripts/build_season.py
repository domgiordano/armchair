#!/usr/bin/env python3
"""Builds fixtures/seasons/dwts-<n>.json for a finished season from its Wikipedia page.

    cd backend
    python scripts/build_season.py 12             # the revision the fixture records, else the latest
    python scripts/build_season.py 12 --latest    # the latest revision
    python scripts/build_season.py 34 --revid 1375977389
    python scripts/build_season.py 1-34           # a range, one request per page, a second apart

Roster, judges, episodes, performances and per-episode rateable keys all come from one
revision, recorded in the fixture. Rows the parser can't read are listed under `skipped`
with the reason; nothing is filled in by hand. Air dates the page doesn't pin down are null.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lambdas.common.wiki_parse import (
    blocks,
    cell_text,
    clean,
    expand,
    layout,
    panel_of,
    parse_week,
)

SEASONS = Path(__file__).resolve().parents[2] / "fixtures" / "seasons"
UA = {"User-Agent": "armchair/0.1 (https://github.com/domgiordano/armchair)"}
API = "https://en.wikipedia.org/w/api.php"
TITLE = "Dancing with the Stars (American TV series) season {}"
# S15 heads its per-judge columns with surnames only.
MAIN_JUDGES = ["Carrie Ann Inaba", "Len Goodman", "Bruno Tonioli", "Derek Hough", "Julianne Hough"]
NOT_COMPETITION = re.compile(
    r"results|road to|clip|first look|meet the|special|countdown|holidays|dance off", re.IGNORECASE
)
MONTHS = "January February March April May June July August September October November December"


def fetch(title: str, revid: int | None) -> dict:
    params = {
        "action": "query",
        "prop": "revisions",
        "rvprop": "ids|timestamp|content",
        "rvslots": "main",
        "format": "json",
        "formatversion": 2,
    }
    params |= {"revids": revid} if revid else {"titles": title}
    req = urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        rev = json.load(resp)["query"]["pages"][0]["revisions"][0]
    return {
        "revid": rev["revid"],
        "timestamp": rev["timestamp"],
        "text": rev["slots"]["main"]["content"],
    }


def slug(name: str) -> str:
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower().replace("'", "")).strip("-")


def section(text: str, heading: str) -> str:
    m = re.search(
        rf"^==\s*{heading}\s*==\s*$(.*?)(?=^==[^=])", text, flags=re.MULTILINE | re.DOTALL
    )
    return m.group(1) if m else ""


def roster(text: str) -> list[dict]:
    """Celebrity, pro and status from the Cast table, in the page's order."""
    for rows in (b["rows"] for b in blocks(clean(section(text, "Cast")))):
        grid = expand(rows)
        names = [c["text"].lower() for c in grid[0]]
        if "celebrity" not in names or "status" not in names:
            continue
        pro = next(i for i, n in enumerate(names) if "partner" in n)
        return [
            {
                "celebrity": r[names.index("celebrity")]["text"].split("\n")[0],
                "pro": r[pro]["text"].split("\n")[0],
                "status": r[names.index("status")]["text"].split("\n")[0],
            }
            for r in grid[1:]
        ]
    raise ValueError("no Cast table with Celebrity and Status columns")


def couple_rows(text: str) -> list[str]:
    """Every "<celebrity> & <pro>" line in the Couple column of every score table."""
    found = []
    for b in blocks(clean(re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL))):
        lay = layout(b["rows"])
        if lay is None:
            continue
        col = lay["names"].index("couple")
        for row in expand(lay["rows"]):
            found += [c for c in row[col]["text"].split("\n") if "&" in c]
    return found


def words(name: str) -> list[str]:
    """ASCII word tokens: "J.R." and "J. R." both read as initials, "Hélio" as "helio"."""
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.findall(
        r"[a-z0-9]+", re.sub(r"(?<=\b[a-z])\.\s*(?=[a-z]\b)", "", ascii_.replace("'", ""))
    )


def match(celeb: str, pro: str, cast: list[dict]) -> list[dict]:
    """
    Cast members a row header's celebrity half can mean: the full name, the leading
    name(s) ("Billy Ray"), "Conner L." as first name plus last initial, or a run of words
    inside the name ("The Miz"). A shared first name is settled by the pro's first name.
    """
    w = words(celeb)
    k = len(w)
    for rule in (
        lambda n: n == w,
        lambda n: n[:k] == w,
        lambda n: k > 1 and len(w[-1]) == 1 and n[: k - 1] == w[:-1] and n[-1][0] == w[-1],
        lambda n: any(n[i : i + k] == w for i in range(len(n))),
    ):
        found = [c for c in cast if rule(words(c["celebrity"]))]
        if len(found) > 1:
            first = words(pro)[:1]
            found = [c for c in found if words(c["pro"])[:1] == first] or found
        if found:
            return found
    return []


def aliases_for(text: str, cast: list[dict]) -> tuple[dict[str, str], list[str]]:
    aliases: dict[str, str] = {}
    problems = []
    for line in sorted(set(couple_rows(text))):
        celeb, _, pro = (s.strip() for s in line.partition("&"))
        if celeb in aliases:
            continue
        found = match(celeb, pro, cast)
        if len(found) == 1:
            aliases[celeb] = slug(found[0]["celebrity"])
        else:
            problems.append(f"{line!r}: {len(found)} cast matches")
    return aliases, problems


def judge_id(name: str, text: str) -> tuple[str, str]:
    """
    (id, full name) for a name from a judge-order line or a per-judge column header.
    S15's columns give surnames; a guest's full name is the page's link ending in it.
    """
    full = [j for j in MAIN_JUDGES if j.split()[-1] == name]
    if " " not in name and not full:
        full = sorted(set(re.findall(rf"\[\[([^\]|]*\b{re.escape(name)})(?:\|[^\]]*)?\]\]", text)))
    if len(full) == 1:
        name = full[0]
    return slug(name), name


def numeric(v: Decimal | None) -> int | float | None:
    if v is None:
        return None
    return int(v) if v == v.to_integral_value() else float(v)


def dated_episodes(text: str) -> list[tuple[str, date]]:
    """(title, air date) of every episode the page lists, in the page's order."""
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)
    found = [
        (title.strip(), date(int(y), int(m), int(d)))
        for title, y, m, d in re.findall(
            r"\|\s*Title\s*=\s*(.*?)\n.*?OriginalAirDate\s*=\s*\{\{Start date\|(\d+)\|(\d+)\|(\d+)",
            text,
            flags=re.DOTALL,
        )
    ]
    for _, title, when in re.findall(
        r"\|\s*title(\d+)\s*=\s*(.*?)\n\s*\|\s*date\1\s*=\s*(.*?)\n", text
    ):
        found.append((title.strip(), spoken(when)))
    found = [(t, d) for t, d in found if d]
    for b in blocks(clean(text)):
        grid = expand(b["rows"])
        if not grid:
            continue
        names = [c["text"].lower() for c in grid[0]]
        when = next((i for i, n in enumerate(names) if "date" in n), None)
        what = next((i for i, n in enumerate(names) if n == "episode"), None)
        if when is None or what is None:
            continue
        for row in grid[1:]:
            if max(when, what) < len(row) and (d := spoken(row[when]["text"])):
                found.append((row[what]["text"].strip('"'), d))
    return found


def spoken(text: str) -> date | None:
    m = re.search(rf"({MONTHS.replace(' ', '|')}) (\d{{1,2}}), (\d{{4}})", text)
    return datetime.strptime(" ".join(m.groups()), "%B %d %Y").date() if m else None  # noqa: DTZ007 -- a calendar date, no time


def increasing(items: list, key=lambda x: x) -> list:
    """
    The longest run of the list whose keys never go backwards. Drops entries that
    contradict their place in the list: S4 dates "Round 10" in April after May's "Round 9".
    """
    best: list[list[int]] = []
    for i, item in enumerate(items):
        prev = [b for j, b in enumerate(best) if key(items[j]) <= key(item)]
        best.append(max(prev, key=len, default=[]) + [i])
    return [items[i] for i in max(best, key=len, default=[])]


def contains(outer: list[str], inner: list[str]) -> bool:
    k = len(inner)
    return k > 0 and any(outer[i : i + k] == inner for i in range(len(outer) - k + 1))


def numbered(title: str) -> int | None:
    """Week number from "Round 3", "Week 3", "Performance Show: Week 3" or S7-S9's "Episode 703A"."""
    m = re.search(r"\b(?:round|week)\s+(\d+)\b|\bepisode \d(\d\d)[a-z]?\b", title, re.IGNORECASE)
    return int(m.group(1) or m.group(2)) if m else None


def air_dates(text: str, nights: dict[int, int], themes: dict[int, str | None]) -> dict:
    """
    {(week, night): date} for the scored nights the page pins down.

    Episode lists include results shows and specials, and don't always number weeks the
    way the score sections do (S6's "Round 1: Part 3" is week 2). So: when the calendar
    weeks with a competition episode match the competition weeks one for one, pair them
    in order. Otherwise an episode belongs to the week whose theme its title names (S19
    airs weeks 9 and 10 on consecutive nights), then to the week its title numbers.
    """
    eps = increasing(dated_episodes(text), key=lambda e: e[1])
    weeks = sorted(nights)
    by_cal: dict[tuple, list] = {}
    for title, d in eps:
        by_cal.setdefault(d.isocalendar()[:2], []).append((title, d))
    competing = [v for v in by_cal.values() if any(not NOT_COMPETITION.search(t) for t, _ in v)]
    if len(competing) == len(weeks):
        grouped = dict(zip(weeks, competing))
    else:
        grouped = {
            w: [
                (t, d)
                for t, d in eps
                if contains(words(t), words(themes[w] or ""))
                or contains(words(themes[w] or ""), words(t))
            ]
            for w in weeks
        }
        for w in weeks:
            if len(grouped[w]) < nights[w]:
                grouped[w] = [(t, d) for t, d in eps if numbered(t) == w]

    picked = []
    for w in weeks:
        ranked = sorted(grouped[w], key=lambda e: (bool(NOT_COMPETITION.search(e[0])), e[1]))
        days = sorted(d for _, d in ranked[: nights[w]])
        if len(days) == nights[w]:
            picked += [((w, n), d) for n, d in enumerate(days, start=1)]
    return dict(increasing(picked, key=lambda e: e[1]))


def year_of(text: str) -> int:
    m = re.search(r"\[\[Category:(\d{4}) American television seasons\]\]", text)
    if m:
        return int(m.group(1))
    return spoken(re.search(r"premiered on ([^.]*)", text).group(1)).year


def build(season: int, rev: dict, shots: dict[str, dict | None]) -> tuple[dict, list[str]]:
    """The season's fixture and a list of report lines. `shots` is fixtures/headshots.json."""
    text = rev["text"]
    live = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    cast = roster(text)
    aliases, report = aliases_for(text, cast)
    ids = {c["celebrity"]: slug(c["celebrity"]) for c in cast}

    headings = {
        int(m.group(1)): (m.group(2).strip(" :") or None)
        for m in re.finditer(r"^===\s*Week (\d+)\b(.*?)===\s*$", live, flags=re.MULTILINE)
    }
    weeks = {w: parse_week(text, w, aliases) for w in sorted(headings)}
    themes = {w: cell_text(clean(t)) if t else None for w, t in headings.items()}

    judges: dict[str, dict] = {}

    def seat(names: list[str]) -> list[str]:
        out = []
        for name in names:
            jid, full = judge_id(name, text)
            j = judges.setdefault(jid, {"id": jid, "name": full, "aliases": [full]})
            if name not in j["aliases"]:
                j["aliases"].append(name)
            out.append(jid)
        return out

    first_week = re.search(r"^===\s*Week", live, flags=re.MULTILINE)
    default = seat(panel_of(live[: first_week.start()]))

    skipped = []
    episodes = []
    nights = {}
    for w, week in weeks.items():
        skipped += [{"week": w, **r} for r in week["rejected"]]
        skipped += [{"week": w, **u, "reason": "no scores received"} for u in week["unscored"]]
        keep = []
        for p in week["performances"]:
            if p["judges"] is None:
                skipped.append(
                    {
                        "week": w,
                        "night": p["night"],
                        "row": " / ".join(p["contestants"]),
                        "reason": "empty score cell",
                    }
                )
            else:
                keep.append(p)
        nights[w] = max((p["night"] for p in keep), default=0)
        for night in range(1, nights[w] + 1):
            perfs = [p for p in keep if p["night"] == night]
            if not perfs:
                continue
            solo = [p for p in perfs if p["rateable"]]
            panel = seat((solo or perfs)[0]["panel"])
            episodes.append(
                {
                    "ep": len(episodes) + 1,
                    "week": w,
                    "night": night,
                    "airDate": None,
                    "start": None,
                    "end": None,
                    "theme": themes[w],
                    "panel": panel,
                    "dancesPerCouple": max(
                        Counter(p["contestants"][0] for p in solo).values(), default=0
                    ),
                    "rateableKeys": [f"{p['contestants'][0]}#{p['n']}" for p in solo],
                    "performances": [
                        {
                            "contestants": p["contestants"],
                            "n": p["n"],
                            "rateable": p["rateable"],
                            **({"panel": s} if (s := seat(p["panel"])) != panel else {}),
                            "total": numeric(p["total"]),
                            "judges": [numeric(v) for v in p["judges"]],
                            "bonus": p["bonus"],
                            "style": p["style"],
                            "song": p["song"],
                            "result": p["result"],
                        }
                        for p in perfs
                    ],
                }
            )

    dates = air_dates(text, {e["week"]: e["night"] for e in episodes}, themes)
    for e in episodes:
        d = dates.get((e["week"], e["night"]))
        e["airDate"] = d.isoformat() if d else None
    missing = sum(e["airDate"] is None for e in episodes)
    if missing:
        report.append(f"{missing}/{len(episodes)} episodes have no air date on the page")

    last_ep: dict[str, int] = {}
    for e in episodes:
        for p in e["performances"]:
            if p["rateable"]:
                last_ep[p["contestants"][0]] = e["ep"]
    contestants = []
    for c in cast:
        cid = ids[c["celebrity"]]
        out = c["status"].casefold().startswith(("eliminated", "withdrew"))
        if cid not in last_ep:
            report.append(f"{c['celebrity']} has no scored dance")
        contestants.append(
            {
                "id": cid,
                "aliases": sorted(a for a, v in aliases.items() if v == cid),
                "members": [
                    {
                        "name": c["celebrity"],
                        "role": "celebrity",
                        "headshot": shots.get(c["celebrity"]),
                    },
                    {"name": c["pro"], "role": "pro", "headshot": shots.get(c["pro"])},
                ],
                "eliminatedEp": last_ep.get(cid) if out else None,
            }
        )

    if not default:
        default = Counter(tuple(e["panel"]) for e in episodes).most_common(1)[0][0]
    for j in judges.values():
        j["headshot"] = shots.get(j["name"])
    for s in skipped:
        report.append(f"week {s['week']} night {s['night']}: {s['row']!r}: {s['reason']}")

    fixture = {
        "show": "dwts",
        "season": season,
        "year": year_of(text),
        "current": False,
        "wikiTitle": TITLE.format(season),
        "revid": rev["revid"],
        "revTimestamp": rev["timestamp"],
        "timezone": "America/New_York",
        "defaultPanel": list(default),
        "judges": list(judges.values()),
        "episodes": episodes,
        "contestants": contestants,
        "skipped": skipped,
    }
    return fixture, report


def seasons_arg(value: str) -> list[int]:
    first, _, last = value.partition("-")
    return list(range(int(first), int(last or first) + 1))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="build_season")
    parser.add_argument("seasons", type=seasons_arg, help="season number or range, e.g. 12 or 1-34")
    parser.add_argument("--revid", type=int, help="build from this revision (one season only)")
    parser.add_argument("--latest", action="store_true", help="ignore the recorded revision")
    args = parser.parse_args(argv)
    if args.revid and len(args.seasons) > 1:
        parser.error("--revid needs a single season")

    shots = json.loads((SEASONS.parent / "headshots.json").read_text())
    for i, n in enumerate(args.seasons):
        if i:
            time.sleep(1)
        path = SEASONS / f"dwts-{n}.json"
        revid = args.revid
        if revid is None and not args.latest and path.exists():
            revid = json.loads(path.read_text())["revid"]
        fixture, report = build(n, fetch(TITLE.format(n), revid), shots)
        path.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n")
        perfs = sum(len(e["performances"]) for e in fixture["episodes"])
        print(f"S{n} rev {fixture['revid']}: {len(fixture['episodes'])} episodes, {perfs} dances")
        for line in report:
            print(f"  {line}")


if __name__ == "__main__":
    main()
