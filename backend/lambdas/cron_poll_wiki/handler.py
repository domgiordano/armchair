"""
EventBridge Scheduler, every minute 8-10:59 pm ET on Mon and Tue: fetch the S35
page once and publish judges' scores for every aired episode that has no
results yet. Values go provisional -> confirmed through common/confirm.py; an
episode's `results` and its contestants' `eliminatedEp` are written once every
score is confirmed and the Result column is filled.

Invoke with {"backfill": true} to publish every episode that aired before today
(ET) with its values confirmed at once. Their revisions are long settled, so
there is no window to wait out. Run it from the Backfill Scores workflow.

Every episode it processes is reconciled into the leaderboard sums
(common/board_dynamo.py), so a backfill also counts dances scored before the
board existed.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from lambdas.common import board_dynamo, confirm
from lambdas.common.dynamo import query_all, table, update
from lambdas.common.episodes_dynamo import episode_pk, performances
from lambdas.common.logger import get_logger
from lambdas.common.wiki_parse import norm, parse_week

SHOW, SEASON = "dwts", 35
SEASON_PK = f"SEASON#{SHOW}#{SEASON}"
USER_AGENT = "armchair/0.1 (https://github.com/domgiordano/armchair)"
API = "https://en.wikipedia.org/w/api.php"

log = get_logger(__file__)


def now() -> int:
    return int(time.time())


def fetch(title: str) -> dict:
    query = urlencode(
        {
            "action": "query",
            "prop": "revisions",
            "titles": title,
            "rvprop": "ids|timestamp|content",
            "rvslots": "main",
            "format": "json",
            "formatversion": "2",
        }
    )
    req = Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=10) as resp:
        return json.load(resp)["query"]["pages"][0]["revisions"][0]


def current_week(wikitext: str, aliases: dict[str, str]) -> dict | None:
    """The highest week with any table rows. Pre-show tables list couples with empty scores."""
    numbers = {int(n) for n in re.findall(r"^===\s*Week (\d+)", wikitext, flags=re.MULTILINE)}
    for n in sorted(numbers, reverse=True):
        week = parse_week(wikitext, n, aliases)
        if week and (week["performances"] or week["rejected"]):
            return week
    return None


def due(episodes: list[dict], tz: str, t: int, backfill: bool) -> list[dict]:
    """Live: aired (past its start time, ET) and no results yet. Backfill: aired before today."""
    local = datetime.fromtimestamp(t, ZoneInfo(tz))
    if backfill:
        return [e for e in episodes if e["airDate"] < local.date().isoformat()]
    stamp = local.strftime("%Y-%m-%dT%H:%M")
    return [
        e for e in episodes if e.get("results") is None and f"{e['airDate']}T{e['start']}" <= stamp
    ]


def judge_ids(names: list[str], judges: list[dict]) -> list[str]:
    """Panel names from the judge-order line as JUDGE# ids. An unknown name is a guest: create it."""
    known = {norm(a): j["sk"].removeprefix("JUDGE#") for j in judges for a in j.get("aliases", [])}
    ids = []
    for name in names:
        jid = known.get(norm(name))
        if jid is None:
            jid = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")
            update(
                "CATALOG_TABLE",
                {"pk": SEASON_PK, "sk": f"JUDGE#{jid}"},
                {"name": name, "aliases": [name]},
                "attribute_not_exists(sk)",
            )
        ids.append(jid)
    return ids


def publish(
    episode: dict,
    panel: list[str],
    perfs: list[dict],
    rev: int,
    t: int,
    window: int,
    season: tuple[str, int] = (SHOW, SEASON),
    settled: list[str] | None = None,
) -> bool:
    """
    Writes one episode's performances, then its results once every value is
    confirmed and every Result cell is filled. True if anything is still provisional.
    Each performance's `panel` is JUDGE# ids; `panel` is the episode's.

    `settled` is a finished season's eliminations for this episode, from the Cast
    table: results are then written without waiting on Result cells, which early
    seasons leave out on nights with no elimination.
    """
    ep = int(episode["sk"].removeprefix("EP#"))
    pk = episode_pk(*season, ep)
    season_pk = f"SEASON#{season[0]}#{season[1]}"
    if episode.get("panel") != panel:
        update("CATALOG_TABLE", {"pk": season_pk, "sk": episode["sk"]}, {"panel": panel})

    stored = {p["sk"]: p for p in performances(pk)}
    pending = False
    final = bool(perfs)
    for p in perfs:
        # A team dance shares its members' ordinals, so its key names every member.
        sk = f"PERF#{'+'.join(p['contestants'])}#{p['n']}"
        old = stored.get(sk, {})
        item = {
            "contestants": p["contestants"],
            "rateable": p["rateable"],
            "style": p["style"],
            "song": p["song"],
            "judges": confirm.judges(
                old.get("judges", {}), p["panel"], p["judges"], t, rev, window
            ),
            "bonus": p["bonus"],
        }
        if any(old.get(k) != v for k, v in item.items()):
            # An older revision never overwrites a newer one's values.
            update(
                "PERFORMANCES_TABLE",
                {"pk": pk, "sk": sk},
                {**item, "rev": rev},
                "attribute_not_exists(sk) OR #rev <= :rev",
            )
        states = [j["state"] for j in item["judges"].values()]
        pending |= "provisional" in states
        final &= p["judges"] is not None and "provisional" not in states
        final &= settled is not None or not p["rateable"] or p["result"] is not None

    if final and episode.get("results") is None:
        solo = [p for p in perfs if p["rateable"]]
        out = sorted(
            settled
            if settled is not None
            else {
                p["contestants"][0] for p in solo if p["result"].casefold().startswith("eliminated")
            }
        )
        totals: dict = {}
        bonus: dict = {}
        for p in solo:
            cid = p["contestants"][0]
            totals[cid] = totals.get(cid, 0) + p["total"]
            if p["bonus"] is not None:
                bonus[cid] = bonus.get(cid, 0) + p["bonus"]
        for cid in out:
            if not update(
                "CATALOG_TABLE",
                {"pk": season_pk, "sk": f"CONTESTANT#{cid}"},
                {"eliminatedEp": ep},
                "attribute_not_exists(#eliminatedEp) OR #eliminatedEp = :eliminatedEp",
            ):
                log.warning("%s is already out in another episode, not ep %d", cid, ep)
        # Written last: results are what marks the episode done.
        update(
            "CATALOG_TABLE",
            {"pk": season_pk, "sk": episode["sk"]},
            {"results": {"eliminated": out, "totals": totals, "bonus": bonus}},
            "attribute_not_exists(#results)",
        )
    return pending


def handler(event, context):
    backfill = (event or {}).get("backfill") is True
    rows = query_all(table("CATALOG_TABLE"), SEASON_PK)
    meta = next(r for r in rows if r["sk"] == "META")
    rev = fetch(meta["wikiTitle"])
    revid = rev["revid"]
    line = {"revid": revid, "timestamp": rev["timestamp"]}

    # Skip the parse only when nothing is waiting out its confirm window.
    if not backfill and revid == meta.get("lastRevid") and not meta.get("pending"):
        # A bare JSON line, not the logger's prefixed format, so Logs Insights
        # discovers the fields without a parse step.
        print(json.dumps({**line, "unchanged": True}))
        return {"revid": revid, "unchanged": True}

    t = now()
    text = rev["slots"]["main"]["content"]
    aliases = {
        a: r["sk"].removeprefix("CONTESTANT#")
        for r in rows
        if r["sk"].startswith("CONTESTANT#")
        for a in r.get("aliases", [])
    }
    judges = [r for r in rows if r["sk"].startswith("JUDGE#")]
    episodes = sorted((r for r in rows if r["sk"].startswith("EP#")), key=lambda e: e["sk"])
    window = 0 if backfill else confirm.WINDOW

    todo = due(episodes, meta["timezone"], t, backfill)
    pending = False
    processed = []
    for w in sorted({int(e["week"]) for e in todo}):
        week = parse_week(text, w, aliases)
        if week is None:
            continue
        ids = {}
        for p in [week] + week["performances"]:
            key = tuple(p["panel"])
            if key not in ids:
                ids[key] = judge_ids(p["panel"], judges)
        # Two-night weeks are two EP items in air order; the parser numbers the nights.
        nights = [e for e in episodes if int(e["week"]) == w]
        for night, episode in enumerate(nights, start=1):
            if episode not in todo:
                continue
            perfs = [
                {**p, "panel": ids[tuple(p["panel"])]}
                for p in week["performances"]
                if p["night"] == night
            ]
            panel = perfs[0]["panel"] if perfs else ids[tuple(week["panel"])]
            pending |= publish(episode, panel, perfs, revid, t, window)
            ep = int(episode["sk"].removeprefix("EP#"))
            board_dynamo.reconcile(SHOW, SEASON, ep, panel)
            processed.append(ep)

    if not backfill:
        update(
            "CATALOG_TABLE",
            {"pk": SEASON_PK, "sk": "META"},
            {"lastRevid": revid, "lastRunAt": t, "pending": pending},
        )

    week = current_week(text, aliases)
    print(
        json.dumps({**line, "week": week, "episodes": processed, "pending": pending}, default=float)
    )
    return {
        "revid": revid,
        "week": week and week["week"],
        "episodes": processed,
        "pending": pending,
    }
