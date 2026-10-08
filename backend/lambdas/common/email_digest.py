"""
The weekly results digest, as jobs for mailer.run_jobs. Spoiler rules here; the
template only lays out what this module hands it.

A period is a DWTS week or a Traitors release night. Its digest is due
DUE_AFTER the period's last episode starts, so the poller has settled the
judges or the results, and stops being sent STALE after, so a late deploy
never mails a season's history.

Spoilers. The subject and preview never carry a result. A reader sees numbers
only through the last period they have revealed: every episode in it answered,
or closed (gate.results_open, traitors_gate.seen). Standings for everyone are
computed through that same period, so another player's movement can't give
away an unrevealed night. Nothing names a contestant, dance or result: only
players, points and ranks. The apps' "not yet" seal lives in each device's
storage, so the server can't see it; an answered episode counts as revealed.
"""

from __future__ import annotations

import os
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import NamedTuple

from lambdas.common.board_dynamo import err_pk
from lambdas.common.dynamo import query_partitions
from lambdas.common.email_shows import Dwts, Traitors
from lambdas.common.gate import places, results_open
from lambdas.common.groups_dynamo import memberships
from lambdas.common.mailer import Job
from lambdas.common.traitors_board import pts_pk
from lambdas.common.traitors_gate import pick_owner, seen
from lambdas.common.users_dynamo import cards
from lambdas.common.window import closed

DUE_AFTER = timedelta(hours=14)
STALE = timedelta(days=3)
# The leaderboard's floor: below it a DWTS player is listed without a rank.
MIN_DANCES = 5
WEEK_TOP_MIN = 3
GROUP_ROWS = 5
GLOBAL_ROWS = 3

Board = dict[str, dict]


def _add(boards: list[Board]) -> Board:
    total: Board = defaultdict(lambda: defaultdict(float))
    for board in boards:
        for sub, row in board.items():
            for k, v in row.items():
                total[sub][k] += float(v)
    return {s: dict(r) for s, r in total.items()}


class _Spec(NamedTuple):
    """What differs between the shows: how a board ranks and how a number reads."""

    rank: Callable[[Board], dict[str, int]]
    value: Callable[[dict], str]
    week_value: Callable[[dict], str]
    week_line: Callable[[dict], str]
    week_rank: Callable[[Board], dict[str, int]]


def _dwts_places(board: Board, floor: int) -> dict[str, int]:
    shaped = {
        s: {"count": r["n"], "mae": r["err"] / r["n"]} for s, r in board.items() if r.get("n")
    }
    return places(shaped, floor)


DWTS = _Spec(
    rank=lambda b: _dwts_places(b, MIN_DANCES),
    value=lambda r: f"{r['err'] / r['n']:.2f} off" if r.get("n") else "no dances yet",
    week_value=lambda r: f"{r['err'] / r['n']:.2f} off",
    week_line=lambda r: (
        f"Across {int(r['n'])} dance{'s' if r['n'] != 1 else ''} you were "
        f"{r['err'] / r['n']:.2f} points off the judges on average."
    ),
    week_rank=lambda b: _dwts_places(b, WEEK_TOP_MIN),
)


def _traitors_places(board: Board) -> dict[str, int]:
    """Points, then correct banishments, then events scored; a full tie shares a rank."""
    key = {s: (r.get("pts", 0), r.get("hits", 0), r.get("events", 0)) for s, r in board.items()}
    order = sorted(key, key=lambda s: key[s], reverse=True)
    out: dict[str, int] = {}
    for i, s in enumerate(order):
        out[s] = out[order[i - 1]] if i and key[s] == key[order[i - 1]] else i + 1
    return out


TRAITORS = _Spec(
    rank=_traitors_places,
    value=lambda r: f"{int(r.get('pts', 0))} pts",
    week_value=lambda r: f"+{int(r.get('pts', 0))} pts",
    week_line=lambda r: (
        f"You earned {int(r.get('pts', 0))} points from {int(r.get('events', 0))} "
        f"call{'s' if r.get('events') != 1 else ''} this week."
    ),
    week_rank=lambda b: _traitors_places({s: r for s, r in b.items() if r.get("pts")}),
)


def _rows(
    spec: _Spec,
    board: Board,
    before: Board | None,
    subs: set[str],
    me: str,
    limit: int,
    names: dict,
) -> list[dict]:
    """The top `limit` of `subs` by `board`, plus the reader's own row if it fell below."""
    ranks = spec.rank({s: r for s, r in board.items() if s in subs})
    old = spec.rank({s: r for s, r in before.items() if s in subs}) if before else {}
    order = sorted(
        (s for s in subs if s in board),
        key=lambda s: (ranks.get(s) is None, ranks.get(s) or 0, names[s].casefold()),
    )
    shown = order[:limit] + ([me] if me in order[limit:] else [])
    return [
        {
            "rank": ranks.get(s),
            "name": names[s],
            "value": spec.value(board[s]),
            "move": old[s] - ranks[s] if s in old and s in ranks else None,
            "me": s == me,
        }
        for s in shown
    ]


def _context(
    spec: _Spec,
    sub: str,
    p: int,
    cutoff: int | None,
    labels: list[str],
    cums: list[Board],
    weekly: list[Board],
    names: dict[str, str],
    groups: list[dict],
    url: str,
) -> dict:
    revealed = cutoff == p
    ctx = {
        "label": labels[p],
        "revealed": revealed,
        "through": None if cutoff is None or revealed else labels[cutoff],
        "url": url,
        "you": None,
        "groups": [],
        "global": None,
        "top": None,
    }
    if cutoff is None:
        return ctx
    board, before = cums[cutoff], cums[cutoff - 1] if cutoff else None
    ranks = spec.rank(board)
    mine = board.get(sub, {})
    place = f"#{ranks[sub]} of {len(ranks)}" if sub in ranks else "Unranked"
    if revealed and weekly[p].get(sub):
        week = weekly[p][sub]
        cells = [
            ("This week", spec.week_value(week)),
            ("Season", spec.value(mine)),
            ("Rank", place),
        ]
        line = spec.week_line(week)
    else:
        cells = [("Season", spec.value(mine)), ("Rank", place)]
        line = (
            f"Through {labels[cutoff]}: {spec.value(mine)}, {place[0].lower() + place[1:]}."
            if not revealed
            else f"Nothing of yours counted in {labels[p]}."
        )
    ctx["you"] = {"cells": cells, "line": line}
    note = None if revealed else f"Through {labels[cutoff]}."
    for g in groups:
        rows = _rows(spec, board, before, g["members"], sub, GROUP_ROWS, names)
        ctx["groups"].append({"name": g["name"], "rows": rows, "note": note})
    ctx["global"] = {
        "rows": _rows(spec, board, before, set(board), sub, GLOBAL_ROWS, names),
        "note": note,
    }
    if revealed:
        top = spec.week_rank(weekly[p])
        best = sorted(top, key=lambda s: top[s])[:3]
        ctx["top"] = [
            {"rank": top[s], "name": names[s], "value": spec.week_value(weekly[p][s])} for s in best
        ]
    return ctx


def _jobs(
    show: str,
    event_prefix: str,
    spec: _Spec,
    periods: list[list[int]],
    starts: dict[int, datetime | None],
    labels: list[str],
    now: datetime,
    load: Callable[[int], tuple[list[Board], dict[str, set[int]], set[str]]],
    url: Callable[[int, bool, list[int]], str],
) -> list[Job]:
    jobs = []
    for p, eps in enumerate(periods):
        times = [starts[n] for n in eps]
        if None in times or not max(times) + DUE_AFTER <= now < max(times) + STALE:
            continue
        # weekly[i]: each player's sums for period i; open_: episodes each reader has revealed.
        weekly, open_, readers = load(p)
        cums = [_add(weekly[: i + 1]) for i in range(p + 1)]
        groups = {sub: memberships(sub) for sub in readers}
        # Names for everyone on a board, and everyone in a reader's group.
        mates = {s for gs in groups.values() for g in gs for s in g["members"]}
        everyone = set().union(*weekly) | readers | mates
        names = {s: c["name"] or "A player" for s, c in cards(everyone).items()}
        readers_ctx = {}
        for sub in readers:
            done = open_.get(sub, set())
            whole = [i for i in range(p + 1) if set(periods[i]) <= done]
            cutoff = whole[-1] if whole else None
            unseen = [n for n in eps if n not in done]
            readers_ctx[sub] = _context(
                spec,
                sub,
                p,
                cutoff,
                labels,
                cums,
                weekly,
                names,
                groups[sub],
                url(p, cutoff == p, unseen),
            )
        jobs.append(Job(show, "digest", f"{event_prefix}#{p:02d}", readers_ctx))
    return jobs


def dwts(season: Dwts, now: datetime) -> list[Job]:
    weeks = sorted({season.week(n) for n in season.episodes})
    periods = [sorted(n for n in season.episodes if season.week(n) == w) for w in weeks]
    labels = [f"Week {w}" for w in weeks]

    def load(p: int):
        eps = [n for period in periods[: p + 1] for n in period]
        errs = query_partitions("BOARD_TABLE", [err_pk("dwts", season.number, n) for n in eps])
        perfs = query_partitions("PERFORMANCES_TABLE", [season.pk(n) for n in eps])
        scores = season.scores(eps)
        weekly = []
        for period in periods[: p + 1]:
            board: Board = defaultdict(lambda: {"n": 0.0, "err": 0.0})
            for n in period:
                for row in errs[err_pk("dwts", season.number, n)]:
                    sub = row["sk"].partition("#USER#")[2]
                    board[sub]["n"] += 1
                    board[sub]["err"] += float(row["err"])
            weekly.append(dict(board))
        readers = {row["sk"].partition("#USER#")[2] for rows in scores.values() for row in rows}
        done: dict[str, set[int]] = defaultdict(set)
        for n in eps:
            shut = closed(season.meta, season.spans[n], now)
            for sub in readers:
                if results_open(
                    sub,
                    n,
                    season.meta,
                    season.episodes[n],
                    season.contestants,
                    perfs[season.pk(n)],
                    scores[n],
                    shut,
                ):
                    done[sub].add(n)
        return weekly, done, readers

    def url(p: int, revealed: bool, unseen: list[int]) -> str:
        return f"{os.environ['DWTS_URL']}/leaderboard/" if revealed else season.url(unseen[0])

    return _jobs("dwts", season.id, DWTS, periods, season.airs, labels, now, load, url)


def traitors(season: Traitors, now: datetime) -> list[Job]:
    periods = season.nights()
    labels = [season.label(eps) for eps in periods]

    def load(p: int):
        eps = [n for period in periods[: p + 1] for n in period]
        pts = query_partitions(
            "BOARD_TABLE", [pts_pk(season.edition, season.number, n) for n in eps]
        )
        picks = season.picks(eps)
        weekly = []
        for period in periods[: p + 1]:
            board: Board = defaultdict(lambda: {"pts": 0.0, "events": 0.0, "hits": 0.0})
            for n in period:
                for row in pts[pts_pk(season.edition, season.number, n)]:
                    sub = row["sk"].partition("#USER#")[2]
                    board[sub]["pts"] += float(row["pts"])
                    board[sub]["events"] += 1
                    board[sub]["hits"] += float(bool(row.get("hit")))
            weekly.append(dict(board))
        readers = {pick_owner(row)[1] for rows in picks.values() for row in rows}
        done: dict[str, set[int]] = defaultdict(set)
        for n in eps:
            for sub in readers:
                if seen(sub, season.meta, season.episodes[n], picks[n]):
                    done[sub].add(n)
        return weekly, done, readers

    def url(p: int, revealed: bool, unseen: list[int]) -> str:
        if revealed:
            return f"{os.environ['TRAITORS_URL']}/leaderboard/?season={season.id}"
        return season.url(unseen[0])

    return _jobs("traitors", season.id, TRAITORS, periods, season.releases, labels, now, load, url)
