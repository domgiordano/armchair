"""
EventBridge Scheduler, 9 am ET the mornings after show nights (Tue, Wed): AI
write-ups for every dance of the current DWTS season's episodes that aired in
the last WINDOW_DAYS, from published recaps (common/recaps.py, common/writeups.py).

Invoke with {"backfill": true, "season": "dwts-35", "weeks": [1, 2, 3, 4]} to
write every aired episode of those weeks; `force: true` rewrites dances that
already have one. Run it from the Backfill Write-ups workflow.

A dance is written once every panel judge's score is confirmed and some recap
has a passage about its couple; until then each run looks again, which costs a
cached S3 read per article and nothing at Anthropic. Each episode's spend is
summed on its META row across runs and capped at EPISODE_CAP.
"""

from __future__ import annotations

import json
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from lambdas.common import claude, recaps, wiki_fetch, writeups
from lambdas.common.dynamo import query_all, table
from lambdas.common.episodes_dynamo import (
    episode_pk,
    performances,
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


def handler(event, context):
    event = event or {}
    # Before any work, so a missing key fails every run loudly rather than on the first call.
    claude.api_key()
    backfill = event.get("backfill") is True
    if backfill:
        show, number = season_ref(event)
        seasons = [number]
    else:
        show = SHOW
        seasons = [int(r["number"]) for r in season_index(show) if r.get("current")]
    seasons = [n for n in seasons if n >= FIRST_SEASON]

    report, failed = [], []
    for number in seasons:
        rows = season_rows(show, number)
        by_sk = {r["sk"]: r for r in rows}
        meta = by_sk["META"]
        today = datetime.now(ZoneInfo(meta["timezone"])).date()
        episodes = due(
            [r for r in rows if r["sk"].startswith("EP#")],
            today,
            event.get("weeks") if backfill else None,
        )
        if not episodes:
            continue
        wikitext = wiki_fetch.latest(meta["wikiTitle"])["content"]
        contestants = {cid(r): r for r in rows if r["sk"].startswith("CONTESTANT#")}
        judges = {
            r["sk"].removeprefix("JUDGE#"): r["name"] for r in rows if r["sk"].startswith("JUDGE#")
        }
        for episode in episodes:
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
    ready = [
        p
        for p in performances(pk)
        if confirmed(p, panel)
        and all(judges.get(j) for j in panel)
        and all(c in contestants for c in p["contestants"])
        and (force or p["sk"] not in stored)
    ]
    if not ready:
        return {"status": "nothing to write"}

    week = int(episode["week"])
    urls = recaps.cited(recaps.week_section(wikitext, week))
    urls += [
        u for u in recaps.guessed(number, int(meta["year"]), episode.get("theme")) if u not in urls
    ]
    articles = [a for a in map(recaps.fetch, urls) if a and a["status"] == 200 and a["text"]]
    roster = list(contestants.values())
    cuts = [(a["url"], recaps.sections(a["text"], roster)) for a in articles]
    perfs = [
        writeups.facts(p, panel, contestants, judges, cut)
        for p in ready
        if (cut := excerpts(p, cuts))
    ]
    if not perfs:
        return {"status": "no recaps yet", "urls": len(urls), "articles": len(articles)}

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
        "articles": len(articles),
        "inputTokens": usage.get("input_tokens"),
        "outputTokens": usage.get("output_tokens"),
        "costUsd": round(paid, 4),
        "spentUsd": round(spent + paid, 4),
    }
