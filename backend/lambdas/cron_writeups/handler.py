"""
AI write-ups for every dance of the current DWTS season's episodes that aired in
the last WINDOW_DAYS, from published recaps (common/recaps.py, common/writeups.py).
Nothing schedules the default run since the Anthropic account ran out of credits;
an outside writer uses the prepare and store modes below instead.

Invoke with {"backfill": true, "season": "dwts-35", "weeks": [1, 2, 3, 4]} to
write every aired episode of those weeks; `force: true` rewrites dances that
already have one. Run it from the Backfill Write-ups workflow.

A dance is written once every panel judge's score is confirmed and some recap
has a passage about its couple; until then each run looks again, which costs a
cached S3 read per article and nothing at Anthropic. Each episode's spend is
summed on its META row across runs and capped at EPISODE_CAP.

Two modes hand the writing to a writer outside the Lambda, with no Anthropic call:
- {"mode": "prepare"} takes the same selection ("season", "weeks", "force", or
  none for the current season's last WINDOW_DAYS) and returns, per episode, each
  ready dance's inputs and the prompt verbatim. When that would pass Lambda's
  6 MB response limit, each episode goes to S3 under PREPARED and the answer
  carries its key instead.
- {"mode": "store", "model": ..., "source": ..., "items": [...]} (or "s3_key"
  naming a JSON object with those fields under recaps/) checks each write-up
  and writes the ones validate() would keep whole, overwriting. The rest come
  back with reasons.
"""

from __future__ import annotations

import json
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from lambdas.common import claude, recaps, wiki_fetch, writeups
from lambdas.common.api import ValidationError
from lambdas.common.dynamo import query_all, table
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
    ref,
    season_index,
    season_ref,
    season_rows,
)
from lambdas.common.gate import cid
from lambdas.common.logger import get_logger

log = get_logger(__file__)

SHOW = "dwts"
FIRST_SEASON = 35
WINDOW_DAYS = 7
EPISODE_CAP = 1.00
# Under Lambda's 6 MB synchronous response limit, with room for the runtime's envelope.
PAYLOAD_LIMIT = 5_000_000
PREPARED = recaps.PREFIX + "prepare/"
STORE_FIELDS = ("season", "ep", "key", "summary", "judges", "highlights", "sources")


def handler(event, context):
    event = event or {}
    mode = event.get("mode")
    if mode == "store":
        return store(event)
    if mode == "prepare":
        return prepare(event)
    if mode is not None:
        raise ValueError(f"unknown mode {mode!r}")
    # Before any work, so a missing key fails every run loudly rather than on the first call.
    claude.api_key()
    report, failed = [], []
    for show, number, meta, episode, contestants, judges, wikitext in selected(
        event, event.get("backfill") is True
    ):
        ep = int(episode["sk"].removeprefix("EP#"))
        try:
            line = write_episode(
                show,
                number,
                meta,
                episode,
                contestants,
                judges,
                wikitext,
                event.get("force") is True,
            )
        except claude.ClaudeError as e:
            # One bad episode shouldn't hold up the rest; the run still fails below.
            log.error("write-ups for %s-%d ep %d failed: %s", show, number, ep, e)
            failed.append(ep)
            continue
        # A bare JSON line, so Logs Insights discovers the fields without a parse step.
        print(json.dumps({"season": f"{show}-{number}", "ep": ep, **line}))
        report.append({"ep": ep, **line})

    if failed:
        raise RuntimeError(f"write-ups failed for episodes {failed}")
    return {"episodes": report}


def selected(event: dict, explicit: bool):
    """
    (show, season, META, EP item, contestants by id, judge names by id, wikitext)
    per episode due: of the event's season and weeks when `explicit`, else the
    current season's last WINDOW_DAYS.
    """
    if explicit:
        show, number = season_ref(event)
        seasons = [number]
    else:
        show = SHOW
        seasons = [int(r["number"]) for r in season_index(show) if r.get("current")]
    for number in [n for n in seasons if n >= FIRST_SEASON]:
        rows = season_rows(show, number)
        meta = next(r for r in rows if r["sk"] == "META")
        today = datetime.now(ZoneInfo(meta["timezone"])).date()
        episodes = due(
            [r for r in rows if r["sk"].startswith("EP#")],
            today,
            event.get("weeks") if explicit else None,
        )
        if not episodes:
            continue
        wikitext = wiki_fetch.latest(meta["wikiTitle"])["content"]
        contestants = {cid(r): r for r in rows if r["sk"].startswith("CONTESTANT#")}
        judges = {
            r["sk"].removeprefix("JUDGE#"): r["name"] for r in rows if r["sk"].startswith("JUDGE#")
        }
        for episode in episodes:
            yield show, number, meta, episode, contestants, judges, wikitext


def due(episodes: list[dict], today: date, weeks: list[int] | None) -> list[dict]:
    """Aired before today; of `weeks` when given, else within WINDOW_DAYS."""
    aired = [e for e in episodes if e.get("airDate") and e["airDate"] < today.isoformat()]
    if weeks is not None:
        return [e for e in aired if int(e["week"]) in {int(w) for w in weeks}]
    since = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    return [e for e in aired if e["airDate"] >= since]


def excerpts(perf: dict, cuts: list[tuple[str, dict[str, str]]]) -> list[tuple[str, str]]:
    """(url, text) per article with a passage about any of the dance's couples."""
    out = []
    for url, parts in cuts:
        text = "\n".join(parts[c] for c in perf["contestants"] if c in parts)
        if text:
            out.append((url, text))
    return out


def confirmed(perf: dict, panel: list[str]) -> bool:
    """Every panel judge's value confirmed. A judge who sat it out leaves no score to check against."""
    judges = perf.get("judges") or {}
    return all(
        (judges.get(j) or {}).get("state") == "confirmed" and judges[j].get("value") is not None
        for j in panel
    )


def ready(
    pk: str, panel: list[str], contestants: dict[str, dict], judges: dict[str, str], skip: set[str]
) -> list[dict]:
    """The episode's performances with every score confirmed, minus the sks in `skip`."""
    return [
        p
        for p in performances(pk)
        if confirmed(p, panel)
        and all(judges.get(j) for j in panel)
        and all(c in contestants for c in p["contestants"])
        and p["sk"] not in skip
    ]


def gather(
    perfs: list[dict],
    panel: list[str],
    number: int,
    meta: dict,
    episode: dict,
    contestants: dict[str, dict],
    judges: dict[str, str],
    wikitext: str,
) -> tuple[list[dict], int, int]:
    """(facts() of each of `perfs` some recap has a passage about, URLs tried, articles read)."""
    urls = recaps.cited(recaps.week_section(wikitext, int(episode["week"])))
    urls += [
        u for u in recaps.guessed(number, int(meta["year"]), episode.get("theme")) if u not in urls
    ]
    articles = [a for a in map(recaps.fetch, urls) if a and a["status"] == 200 and a["text"]]
    roster = list(contestants.values())
    cuts = [(a["url"], recaps.sections(a["text"], roster)) for a in articles]
    facts = [
        writeups.facts(p, panel, contestants, judges, cut)
        for p in perfs
        if (cut := excerpts(p, cuts))
    ]
    return facts, len(urls), len(articles)


def write_episode(
    show: str,
    number: int,
    meta: dict,
    episode: dict,
    contestants: dict[str, dict],
    judges: dict[str, str],
    wikitext: str,
    force: bool,
) -> dict:
    ep = int(episode["sk"].removeprefix("EP#"))
    pk = episode_pk(show, number, ep)
    panel = episode.get("panel") or meta["defaultPanel"]
    stored = {r["sk"]: r for r in query_all(table("WRITEUPS_TABLE"), pk)}
    todo = ready(pk, panel, contestants, judges, set() if force else set(stored))
    if not todo:
        return {"status": "nothing to write"}

    week = int(episode["week"])
    perfs, urls, articles = gather(
        todo, panel, number, meta, episode, contestants, judges, wikitext
    )
    if not perfs:
        return {"status": "no recaps yet", "urls": urls, "articles": articles}

    body = writeups.request(perfs, panel, week, episode.get("theme"))
    spent = float(stored.get("META", {}).get("spentUsd") or 0)
    ceiling = claude.estimate(body)
    if spent + ceiling > EPISODE_CAP:
        log.error(
            "ep %d skipped: $%.2f spent plus up to $%.2f for this call is over the $%.2f cap",
            ep,
            spent,
            ceiling,
            EPISODE_CAP,
        )
        return {"status": "over cap", "spentUsd": round(spent, 4), "ceilingUsd": round(ceiling, 4)}

    response = claude.messages(body)
    usage = response.get("usage") or {}
    paid = claude.cost(usage)
    # Recorded before validating, so a response we can't use still counts against the cap.
    table("WRITEUPS_TABLE").update_item(
        Key={"pk": pk, "sk": "META"},
        UpdateExpression="ADD spentUsd :c, inputTokens :i, outputTokens :o, runs :one "
        "SET model = :m, lastRunAt = :t",
        ExpressionAttributeValues={
            ":c": Decimal(str(round(paid, 6))),
            ":i": int(usage.get("input_tokens") or 0),
            ":o": int(usage.get("output_tokens") or 0),
            ":one": 1,
            ":m": response.get("model") or claude.MODEL,
            ":t": int(time.time()),
        },
    )
    written, dropped = writeups.validate(claude.tool_input(response, writeups.TOOL), perfs)
    t = int(time.time())
    with table("WRITEUPS_TABLE").batch_writer() as batch:
        for key, item in written.items():
            batch.put_item(
                Item={
                    "pk": pk,
                    "sk": f"PERF#{key}",
                    **item,
                    "model": claude.MODEL,
                    "generatedAt": t,
                }
            )
    return {
        "status": "written",
        "dances": len(written),
        "empty": sum(
            not (w["summary"] or w["judges"] or w["highlights"]) for w in written.values()
        ),
        "dropped": dropped,
        "articles": articles,
        "inputTokens": usage.get("input_tokens"),
        "outputTokens": usage.get("output_tokens"),
        "costUsd": round(paid, 4),
        "spentUsd": round(spent + paid, 4),
    }


def _plain(v: Decimal) -> int | float:
    return int(v) if v == int(v) else float(v)


def prepare(event: dict) -> dict:
    """The prepare mode: every due episode's inputs, inline or in S3 when too big to return."""
    episodes = [
        prepare_episode(*args, event.get("force") is True)
        for args in selected(event, "season" in event)
    ]
    out = {"mode": "prepare", "system": writeups.SYSTEM, "limits": writeups.LIMITS}
    if len(json.dumps({**out, "episodes": episodes}).encode()) <= PAYLOAD_LIMIT:
        return {**out, "episodes": episodes}
    moved = []
    for e in episodes:
        if e["status"] != "ready":
            moved.append(e)
            continue
        key = f"{PREPARED}{e['season']}/{e['ep']:02d}.json"
        body = json.dumps(e).encode()
        recaps.save(key, e)
        brief = {k: e[k] for k in ("season", "ep", "pk", "week", "theme", "status")}
        moved.append({**brief, "s3Key": key, "bytes": len(body)})
    return {**out, "episodes": moved}


def prepare_episode(
    show: str,
    number: int,
    meta: dict,
    episode: dict,
    contestants: dict[str, dict],
    judges: dict[str, str],
    wikitext: str,
    force: bool,
) -> dict:
    ep = int(episode["sk"].removeprefix("EP#"))
    pk = episode_pk(show, number, ep)
    panel = episode.get("panel") or meta["defaultPanel"]
    week = int(episode["week"])
    head = {
        "season": f"{show}-{number}",
        "ep": ep,
        "pk": pk,
        "week": week,
        "theme": episode.get("theme"),
        "airDate": episode.get("airDate"),
    }
    stored = {r["sk"] for r in query_all(table("WRITEUPS_TABLE"), pk)}
    todo = ready(pk, panel, contestants, judges, set() if force else stored)
    if not todo:
        return {**head, "status": "nothing to write"}
    perfs, urls, articles = gather(
        todo, panel, number, meta, episode, contestants, judges, wikitext
    )
    if not perfs:
        return {**head, "status": "no recaps yet", "urls": urls, "articles": articles}
    body = writeups.request(perfs, panel, week, episode.get("theme"))
    return {
        **head,
        "status": "ready",
        "urls": urls,
        "articles": articles,
        "panel": [{"id": j, "name": judges[j]} for j in panel],
        "performances": [
            {
                "key": f["key"],
                "sk": f"PERF#{f['key']}",
                "dancers": [{"name": m["name"], "role": m["role"]} for m in f["members"]],
                "style": f["style"],
                "song": f["song"],
                "scores": [{"judge": j, "name": n, "value": _plain(v)} for j, n, v in f["judges"]],
                "total": _plain(f["total"]),
                "max": f["max"],
                "excerpts": [{"url": u, "text": t} for u, t in f["excerpts"]],
            }
            for f in perfs
        ],
        "prompt": body["messages"][0]["content"],
        "schema": body["tools"][0]["input_schema"],
    }


def shape(w: object) -> list[str]:
    """What's missing or mistyped in one store item, before anything is read."""
    if not isinstance(w, dict):
        return ["not an object"]
    out = [f"missing {k}" for k in STORE_FIELDS if k not in w]
    if out:
        return out
    if not isinstance(w["key"], str) or not w["key"]:
        out.append("key must be a performance key like amber-glenn#1")
    if w["summary"] is not None and (not isinstance(w["summary"], str) or not w["summary"].strip()):
        out.append("summary must be non-empty text or null")
    if not isinstance(w["judges"], list):
        out.append("judges must be a list")
    else:
        for j in w["judges"]:
            if (
                not isinstance(j, dict)
                or not isinstance(j.get("judge"), str)
                or not isinstance(j.get("paraphrase"), str)
                or not j["paraphrase"].strip()
            ):
                out.append("each judge needs a judge id and non-empty paraphrase")
            elif j.get("quote") is not None and (
                not isinstance(j["quote"], str) or not j["quote"].strip()
            ):
                out.append(f"{j['judge']} quote must be non-empty text or null")
    for field in ("highlights", "sources"):
        v = w[field]
        if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
            out.append(f"{field} must be a list of non-empty strings")
    return out


def store(event: dict) -> dict:
    """The store mode: check each write-up, write the ones that pass whole."""
    if event.get("s3_key"):
        event = {**recaps.load(event["s3_key"]), **event}
    model, source, items = event.get("model"), event.get("source"), event.get("items")
    if not all(isinstance(v, str) and v.strip() for v in (model, source)):
        raise ValueError("store needs model and source, naming the writer")
    if not isinstance(items, list) or not items:
        raise ValueError("store needs a non-empty items list")

    rejected: list[dict] = []
    episodes: dict[tuple[str, int, int], list[tuple[int, dict]]] = {}
    seen: set[tuple[str, int, int, str]] = set()
    for i, w in enumerate(items):
        reasons = shape(w)
        if not reasons:
            try:
                show, number, ep = ref(w)
            except ValidationError as e:
                reasons = [str(e)]
            else:
                if number < FIRST_SEASON:
                    reasons = [f"seasons before {FIRST_SEASON} get no write-ups"]
                elif (show, number, ep, w["key"]) in seen:
                    reasons = ["duplicate of an earlier item"]
        if reasons:
            rejected.append(_rejection(i, w, reasons))
            continue
        seen.add((show, number, ep, w["key"]))
        episodes.setdefault((show, number, ep), []).append((i, w))

    written = []
    t = int(time.time())
    rows_of: dict[tuple[str, int], list[dict]] = {}
    wiki_of: dict[tuple[str, int], str] = {}
    for (show, number, ep), group in episodes.items():
        if (show, number) not in rows_of:
            rows_of[show, number] = season_rows(show, number)
        rows = rows_of[show, number]
        by_sk = {r["sk"]: r for r in rows}
        episode = by_sk.get(f"EP#{ep:02d}")
        if "META" not in by_sk or episode is None:
            rejected += [_rejection(i, w, ["no such episode"]) for i, w in group]
            continue
        meta = by_sk["META"]
        if (show, number) not in wiki_of:
            wiki_of[show, number] = wiki_fetch.latest(meta["wikiTitle"])["content"]
        wikitext = wiki_of[show, number]
        contestants = {cid(r): r for r in rows if r["sk"].startswith("CONTESTANT#")}
        judges = {
            r["sk"].removeprefix("JUDGE#"): r["name"] for r in rows if r["sk"].startswith("JUDGE#")
        }
        pk = episode_pk(show, number, ep)
        panel = episode.get("panel") or meta["defaultPanel"]
        wanted = {f"PERF#{w['key']}" for _, w in group}
        exists = {p["sk"] for p in performances(pk)}
        todo = [p for p in ready(pk, panel, contestants, judges, set()) if p["sk"] in wanted]
        facts, _, _ = gather(todo, panel, number, meta, episode, contestants, judges, wikitext)
        by_key = {f["key"]: f for f in facts}
        ok = {p["sk"] for p in todo}
        with table("WRITEUPS_TABLE").batch_writer() as batch:
            for i, w in group:
                sk = f"PERF#{w['key']}"
                if sk not in exists:
                    reasons = ["no such performance"]
                elif sk not in ok:
                    reasons = ["the judges' scores aren't all confirmed yet"]
                elif w["key"] not in by_key:
                    reasons = ["no recap has a passage about this dance"]
                else:
                    reasons = writeups.problems(w, by_key[w["key"]])
                if reasons:
                    rejected.append(_rejection(i, w, reasons))
                    continue
                kept, _ = writeups.validate({"writeups": [w]}, [by_key[w["key"]]])
                batch.put_item(
                    Item={
                        "pk": pk,
                        "sk": sk,
                        **kept[w["key"]],
                        "model": model,
                        "source": source,
                        "generatedAt": t,
                    }
                )
                written.append({"season": f"{show}-{number}", "ep": ep, "key": w["key"]})

    rejected.sort(key=lambda r: r["index"])
    for r in rejected:
        log.warning("write-up rejected: %s", json.dumps(r))
    return {
        "mode": "store",
        "written": len(written),
        "rejected": len(rejected),
        "items": written,
        "rejections": rejected,
    }


def _rejection(i: int, w: object, reasons: list[str]) -> dict:
    w = w if isinstance(w, dict) else {}
    return {
        "index": i,
        "season": w.get("season"),
        "ep": w.get("ep"),
        "key": w.get("key"),
        "reasons": reasons,
    }
