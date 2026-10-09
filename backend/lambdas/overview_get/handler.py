"""
GET /overview/get?season=dwts-35 - the signed-in home in one call: season
progress, the caller's season numbers, the next episode, their latest reveals
and the couples' standings.

Every aired episode is read through gate.episode_view, and everything below is
built from what it returns: judge values only on performances the caller has
answered, eliminations only from episodes they have finished, and no other
user's value. So couples' averages and "couples left" are as of the caller's
own scorecard, not the broadcast. A past season (gate.is_open) shows all of
it, and its episodes come back complete, as does an episode whose scoring
window (common/window.py) has closed. Each episode carries its `window`
{opensAt, closesAt, open}; `activeEpisode` is the one taking answers now with
the caller's progress on it, or null. The schedule is public; seasons_get
serves it too. The season leaderboard is leaderboard_get's. Dances the caller
locked in without revealing (common/seals.py, plus any a device names in
`sealed=<ep>:<key>,...`) stay locked: they leave the caller's numbers, the
reveals, the couples' averages and that night's eliminations.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from lambdas.common import seals, window
from lambdas.common.accuracy import errors, summary
from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_ref, season_rows
from lambdas.common.gate import (
    cid,
    episode_view,
    is_open,
    score_owner,
    visible_scores,
)

LATEST = 3


def _now() -> datetime:
    return datetime.now(UTC)


def _at(date: str, time: str, tz: ZoneInfo) -> datetime:
    return datetime.fromisoformat(f"{date}T{time}").replace(tzinfo=tz)


def _iso(t: datetime) -> str:
    return t.astimezone(UTC).isoformat(timespec="minutes").replace("+00:00", "Z")


@api_handler("overview_get")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, season = season_ref(params)
    sealed = seals.of(sub, show, season, params)
    rows = season_rows(show, season)
    by_sk = {r["sk"]: r for r in rows}
    meta = by_sk.get("META")
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    judges = {sk.removeprefix("JUDGE#"): r for sk, r in by_sk.items() if sk.startswith("JUDGE#")}
    tz = ZoneInfo(meta["timezone"])
    now = _now()
    spans = window.spans(meta, rows)

    schedule = []
    for n, ep in sorted(
        (int(sk.removeprefix("EP#")), r) for sk, r in by_sk.items() if sk.startswith("EP#")
    ):
        starts = ends = None
        if ep.get("airDate") and ep.get("start") and ep.get("end"):
            starts = _at(ep["airDate"], ep["start"], tz)
            ends = _at(ep["airDate"], ep["end"], tz)
        entry = {
            "ep": n,
            "week": ep.get("week"),
            "theme": ep.get("theme"),
            "airDate": ep.get("airDate"),
            "startsAt": starts and _iso(starts),
            "endsAt": ends and _iso(ends),
            # A past season's fixture has no start times, and every episode of it has aired.
            "aired": is_open(meta) or (starts is not None and starts <= now),
            "window": window.view(meta, spans[n], now),
        }
        schedule.append((n, ep, entry))
    episodes = [entry for _, _, entry in schedule]

    # Every aired episode's reads in parallel, rather than two after another per episode.
    # A live window always has a view, even on a night with no start time to say it aired.
    past = [(n, ep, e) for n, ep, e in schedule if e["aired"] or e["window"]["open"]]
    pks = [episode_pk(show, season, n) for n, _, _ in past]
    found = query_many([(t, pk) for pk in pks for t in ("PERFORMANCES_TABLE", "SCORES_TABLE")])

    mine = []
    reveals = []
    judged = defaultdict(list)
    out: dict[str, dict] = {}
    for i, (n, ep, entry) in enumerate(past):
        perfs, score_rows = found[2 * i], found[2 * i + 1]
        view = episode_view(
            sub,
            n,
            meta,
            ep,
            contestants,
            perfs,
            score_rows,
            closed=window.closed(meta, spans[n], now),
            sealed=seals.keys(sealed, n),
        )
        # An empty member set leaves only the caller's own rows.
        own_rows = visible_scores(sub, score_rows, set(), sealed=seals.keys(sealed, n))
        errs = errors(view["panel"], perfs, own_rows).get(sub, [])
        mine += errs
        own = [r for r in score_rows if score_owner(r)[1] == sub]
        entry.update(
            rateable=view["rateable"],
            answered=view["answered"],
            complete=view["complete"],
            scored=sum("value" in r for r in own),
            mae=summary(errs)["mae"],
        )
        for c in view.get("eliminated") or []:
            out[c] = {"ep": n, "week": ep.get("week")}

        submitted = {score_owner(r)[0]: r.get("submittedAt", "") for r in own}
        for card in view["performances"]:
            if card["locked"]:
                continue
            # Team dances are left out: one score split across several couples.
            if _confirmed(card) and len(card["contestants"]) == 1:
                values = [j["value"] for j in card["judges"]]
                judged[card["contestants"][0]].append(sum(values) / len(values))
            # A forfeit opened the card but gave nothing to compare.
            if card["mine"] and "value" in card["mine"]:
                reveals.append((submitted.get(card["key"], ""), n, card))

    aired = [e for e in episodes if e["aired"]]
    me = summary(mine)
    closest = min(me["judges"].items(), key=lambda kv: kv[1]["mae"], default=None)
    upcoming = next((e for e in episodes if not e["aired"]), None)
    live = window.active(meta, spans, now)
    current = None
    if live is not None:
        e = next(e for e in episodes if e["ep"] == live)
        pk = episode_pk(show, season, live)
        current = window.summary(live, pk, spans[live], e["rateable"], e["answered"])
    return ok(
        {
            "season": f"{show}-{season}",
            "open": is_open(meta),
            "timezone": meta["timezone"],
            "judges": [
                {"id": j, **{k: r.get(k) for k in ("name", "headshot")}} for j, r in judges.items()
            ],
            "progress": {
                "aired": len(aired),
                "total": len(episodes),
                "couples": len(contestants),
                "couplesLeft": len(contestants) - len(out),
            },
            "me": {
                "scored": sum(e["scored"] for e in aired),
                "count": me["count"],
                "mae": me["mae"],
                "closestJudge": closest
                and {
                    "id": closest[0],
                    "name": judges.get(closest[0], {}).get("name"),
                    "mae": closest[1]["mae"],
                },
                "streak": _streak(aired),
            },
            "next": upcoming
            and {k: upcoming[k] for k in ("ep", "week", "theme", "airDate", "startsAt")},
            "episodes": episodes,
            "activeEpisode": current,
            "reveals": [
                _reveal(n, card)
                for _, n, card in sorted(reveals, key=lambda r: r[:2], reverse=True)[:LATEST]
            ],
            "couples": _standings(contestants, judged, out),
        }
    )


def _reveal(ep: int, card: dict) -> dict:
    values = [j["value"] for j in card["judges"]]
    return {
        "ep": ep,
        **{k: card[k] for k in ("key", "contestants", "style", "song", "judges", "mine")},
        "panelMean": round(sum(values) / len(values), 2) if _confirmed(card) else None,
    }


def _confirmed(card: dict) -> bool:
    return bool(card["judges"]) and all(j["state"] == "confirmed" for j in card["judges"])


def _standings(contestants: list[dict], judged: dict, out: dict[str, dict]) -> list[dict]:
    """Every couple, by the judges' average over the dances the caller has seen scored."""
    couples = []
    for c in contestants:
        means = judged[cid(c)]
        couples.append(
            {
                "id": cid(c),
                "members": [
                    {k: m.get(k) for k in ("name", "role", "headshot")} for m in c["members"]
                ],
                "dances": len(means),
                "average": round(sum(means) / len(means), 2) if means else None,
                "eliminated": out.get(cid(c)),
            }
        )
    return sorted(
        couples,
        key=lambda c: (
            c["eliminated"] is not None,
            c["average"] is None,
            -(c["average"] or 0),
            c["members"][0]["name"],
        ),
    )


def _streak(aired: list[dict]) -> int:
    """
    Episodes in a row, back from the latest, with every performance answered.
    The latest doesn't break it while still unfinished, since it can be caught up.
    Counted from answers, not `complete`, which a past season sets on every episode.
    """
    done = [bool(e["rateable"]) and e["answered"] == e["rateable"] for e in aired]
    if done and not done[-1]:
        done.pop()
    streak = 0
    for complete in reversed(done):
        if not complete:
            break
        streak += 1
    return streak
