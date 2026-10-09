"""
EventBridge Scheduler, every minute 8-10:59 pm ET on Mon and Tue: fetch the S35
page once and publish judges' scores for every aired episode that has no
results yet. Values go provisional -> confirmed through common/confirm.py; an
episode's `results` and its contestants' `eliminatedEp` are written once every
score is confirmed and the Result column is filled.

Every run also writes each episode's lineup from the page: its dances' running
order, style and song, whether that order is real yet (`runningOrder`, see
running()), and where it came from (settle()). {"lineup": true} does only that:
daily, so the cards carry their dance and song days before air, and with
"showDay": true every 30 minutes on an air date, then every 5 in the two hours
before it, so the order lands soon after editors set it, often hours ahead.

Invoke with {"backfill": true} to publish every episode that aired before today
(ET) with its values confirmed at once. Their revisions are long settled, so
there is no window to wait out. Run it from the Backfill Scores workflow.

Every episode it processes is reconciled into the leaderboard sums
(common/board_dynamo.py), so a backfill also counts dances scored before the
board existed.
"""

from __future__ import annotations

import functools
import html
import json
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from lambdas.common import board_dynamo, confirm, digest, guest_judges
from lambdas.common.dynamo import query_all, table, update
from lambdas.common.episodes_dynamo import episode_pk, performances
from lambdas.common.logger import get_logger
from lambdas.common.people import slug
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


# ABC's own release for the week, cited in its section: dances and songs, in a fixed cast order.
PRESS_URL = re.compile(r"https://www\.detpress\.com/abc/pressrelease/[^\s|}<\]]+")
PRESS_LINE = re.compile(r"^(.+?) and partner .+? will perform", re.MULTILINE)


def section(wikitext: str, week: int) -> str:
    head = re.search(rf"^===\s*Week {week}(?!\d).*$", wikitext, flags=re.MULTILINE)
    if not head:
        return ""
    rest = wikitext[head.end() :]
    end = re.search(r"^==", rest, flags=re.MULTILINE)
    return rest[: end.start() if end else len(rest)]


def press_order(url: str, names: dict[str, str]) -> list[str]:
    """Contestant ids in the order the press release lists the couples; [] if it can't be read."""
    try:
        with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=10) as resp:
            page = resp.read().decode("utf-8", "replace")
    # Recovery: an unread release can't rule the order out, so running() goes by the alphabet alone.
    except URLError:
        log.warning("could not read the press release %s", url)
        return []
    text = html.unescape(re.sub(r"<[^>]+>", "\n", page))
    ids = {norm(name): cid for cid, name in names.items()}
    return [ids[norm(m)] for m in PRESS_LINE.findall(text) if norm(m) in ids]


def running(rows: list[dict], names: dict[str, str], press: Callable[[], list[str]]) -> bool:
    """
    Whether a night's table rows are in the order the couples danced. Until show day
    the page lists them alphabetically, or in the press release's cast order, and
    editors reorder them on the day, hours before air or as the show starts. A scored
    row is always where it danced. `names` maps contestant id to celebrity name.
    """
    if any(p["judges"] is not None for p in rows):
        return True
    ids = [p["contestants"][0] for p in rows if len(p["contestants"]) == 1]
    if ids == sorted(ids, key=lambda c: norm(names.get(c, c))):
        return False
    return [c for c in press() if c in ids] != ids


def places(lineup: dict) -> list[str]:
    return sorted(lineup, key=lambda k: lineup[k]["order"])


def settle(episode: dict, lineup: dict, ordered: bool, live: bool, t: int) -> dict:
    """
    What to write for one night: the page's lineup, unless an order already confirmed
    (an admin's by hand, or the live show's) outranks it. Then only the page's dances
    and songs come in, and a dance new to the page goes last. The live show outranks
    an admin; nothing before air outranks either. `orderAt` moves only with the order.
    """
    source = episode.get("orderSource")
    kept = episode.get("lineup") or {}
    if source in ("admin", "live") and not live:
        rest = [k for k in places(lineup) if k not in kept]
        order = [k for k in places(kept) if k in lineup] + rest
        lineup = {k: {**lineup[k], "order": i} for i, k in enumerate(order, start=1)}
        ordered = True
    else:
        source = "live" if live else "wikipedia" if ordered else None
    # A dance added at the end doesn't move anyone already placed.
    same = [k for k in places(lineup) if k in kept] == places(kept) and episode.get(
        "orderSource"
    ) == source
    stamp = datetime.fromtimestamp(t, UTC).isoformat(timespec="seconds")
    return {
        "lineup": lineup,
        "runningOrder": ordered,
        "orderSource": source,
        "orderAt": episode.get("orderAt") if same else stamp if source else None,
    }


def lineups(
    text: str, aliases: dict, episodes: list[dict], names: dict[str, str], t: int
) -> list[int]:
    """
    Writes each episode's `lineup`, {key: {order, style, song}}, `runningOrder`, and
    where the order came from and when (settle()), for every night the page has rows
    for and something changed. Returns the episodes written.
    """
    written = []
    for w in sorted({int(e["week"]) for e in episodes}):
        week = parse_week(text, w, aliases)
        if week is None or not week["performances"]:
            continue
        url = PRESS_URL.search(section(text, w))
        # Read at most once a week, and only for a night the alphabet can't settle.
        press = functools.cache(
            functools.partial(press_order, url.group(0), names) if url else list
        )

        nights = [e for e in episodes if int(e["week"]) == w]
        for night, episode in enumerate(nights, start=1):
            rows = [p for p in week["performances"] if p["night"] == night]
            if not rows:
                continue
            lineup = {
                f"{'+'.join(p['contestants'])}#{p['n']}": {
                    "order": p["order"],
                    "style": p["style"],
                    "song": p["song"],
                }
                for p in rows
            }
            live = any(p["judges"] is not None for p in rows)
            values = settle(episode, lineup, running(rows, names, press), live, t)
            if all(episode.get(k) == v for k, v in values.items()):
                continue
            update("CATALOG_TABLE", {"pk": SEASON_PK, "sk": episode["sk"]}, values)
            written.append(int(episode["sk"].removeprefix("EP#")))
    return written


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
            # people.slug, so the id is the guest's person id: "/people/?id=" finds them.
            jid = slug(name)
            update(
                "CATALOG_TABLE",
                {"pk": SEASON_PK, "sk": f"JUDGE#{jid}"},
                {"name": name, "aliases": [name]},
                "attribute_not_exists(sk)",
            )
        ids.append(jid)
    return ids


def profile_guests(seated: dict[str, str], judges: list[dict], regulars: list[str], t: int) -> None:
    """A photo and bio for each guest on tonight's panels not yet looked up. Runs after
    every score is written, so a slow or failed lookup costs only the guest's photo."""
    stored = {j["sk"].removeprefix("JUDGE#"): j for j in judges}
    for jid, name in seated.items():
        j = stored.get(jid, {})
        if jid in regulars or j.get("headshot") or j.get("profiledAt"):
            continue
        try:
            guest_judges.profile(SHOW, SEASON, jid, j.get("name", name), t)
        # Recovery is the next tick: profiledAt stays unset, and the desk shows initials meanwhile.
        except Exception:
            log.exception("could not profile guest judge %s", jid)


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
        # A team dance has no Result cell of its own.
        final &= settled is not None or len(p["contestants"]) > 1 or p["result"] is not None

    if final and episode.get("results") is None:
        solo = [p for p in perfs if len(p["contestants"]) == 1]
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
    only_lineup = (event or {}).get("lineup") is True
    rows = query_all(table("CATALOG_TABLE"), SEASON_PK)
    meta = next(r for r in rows if r["sk"] == "META")
    # The show-day schedules fire every day; only an air date is worth the request.
    today = datetime.fromtimestamp(now(), ZoneInfo(meta["timezone"])).date().isoformat()
    if (event or {}).get("showDay") is True and not any(
        r.get("airDate") == today for r in rows if r["sk"].startswith("EP#")
    ):
        return {"showDay": False}
    rev = fetch(meta["wikiTitle"])
    revid = rev["revid"]
    line = {"revid": revid, "timestamp": rev["timestamp"]}

    # Skip the parse only when nothing is waiting out its confirm window.
    if (
        not backfill
        and not only_lineup
        and revid == meta.get("lastRevid")
        and not meta.get("pending")
    ):
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

    names = {
        r["sk"].removeprefix("CONTESTANT#"): next(
            m["name"] for m in r["members"] if m["role"] == "celebrity"
        )
        for r in rows
        if r["sk"].startswith("CONTESTANT#")
    }
    ordered = lineups(text, aliases, episodes, names, t)
    if only_lineup:
        print(json.dumps({**line, "lineup": ordered}))
        return {"revid": revid, "lineup": ordered}

    todo = due(episodes, meta["timezone"], t, backfill)
    pending = False
    processed = []
    seated: dict[str, str] = {}
    for w in sorted({int(e["week"]) for e in todo}):
        week = parse_week(text, w, aliases)
        if week is None:
            continue
        ids = {}
        for p in [week] + week["performances"]:
            key = tuple(p["panel"])
            if key not in ids:
                ids[key] = judge_ids(p["panel"], judges)
                seated |= dict(zip(ids[key], p["panel"]))
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
            pending |= publish(episode, panel, perfs, revid, t, window, season=(SHOW, SEASON))
            ep = int(episode["sk"].removeprefix("EP#"))
            board_dynamo.reconcile(SHOW, SEASON, ep, panel)
            # A backfill can rewrite a settled episode's judges.
            digest.forget(SHOW, SEASON, ep)
            processed.append(ep)

    if not backfill:
        update(
            "CATALOG_TABLE",
            {"pk": SEASON_PK, "sk": "META"},
            {"lastRevid": revid, "lastRunAt": t, "pending": pending},
        )

    profile_guests(seated, judges, meta["defaultPanel"], t)

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
