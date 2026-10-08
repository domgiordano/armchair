"""
What the scheduled emails read about each show's current seasons: when episodes
air, who plays, and who has finished what. Reads only; the gate modules decide
what anyone has revealed.

A Traitors edition (tus, tuk, tukc) is its own season and its own emails, under
the one Traitors theme and the one set of Traitors prefs.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from lambdas.common import board_dynamo
from lambdas.common.dynamo import query_all, query_partitions, table
from lambdas.common.episodes_dynamo import episode_pk, season_index, season_rows
from lambdas.common.gate import score_owner
from lambdas.common.group_shows import members_playing
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_gate import ep_number, pick_owner
from lambdas.common.window import airs_at, spans

# Prefixed to a Traitors label so a UK or Celebrity email can't pass for the US one.
EDITION_LABEL = {"tus": "", "tuk": "UK ", "tukc": "Celebrity "}
ZONE_NAME = {"America/New_York": "ET", "Europe/London": "UK time"}


def current_seasons(show: str) -> list[int]:
    return [int(s["number"]) for s in season_index(show) if s.get("current")]


def clock(t: datetime, tz: str) -> str:
    """'8:00 pm ET'."""
    local = t.astimezone(ZoneInfo(tz))
    return f"{local.strftime('%-I:%M %p').lower()} {ZONE_NAME.get(tz, local.strftime('%Z'))}"


def ep_span(eps: list[int], word: str = "Episode") -> str:
    eps = sorted(eps)
    if len(eps) == 1:
        return f"{word} {eps[0]}"
    return f"{word}s {eps[0]}-{eps[-1]}"


class Dwts:
    """One current DWTS season: its catalog rows read once."""

    show = "dwts"

    def __init__(self, number: int):
        self.number = number
        self.id = f"dwts-{number}"
        rows = season_rows("dwts", number)
        self.meta = next(r for r in rows if r["sk"] == "META")
        self.tz = self.meta["timezone"]
        self.contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
        self.episodes = {
            int(r["sk"].removeprefix("EP#")): r for r in rows if r["sk"].startswith("EP#")
        }
        zone = ZoneInfo(self.tz)
        self.airs = {n: airs_at(e, zone) for n, e in self.episodes.items()}
        self.spans = spans(self.meta, rows)

    def pk(self, ep: int) -> str:
        return episode_pk("dwts", self.number, ep)

    def week(self, ep: int) -> int:
        return int(self.episodes[ep].get("week") or ep)

    def label(self, ep: int) -> str:
        """'Week 4', or 'Week 4, night 2' when the week has two episodes."""
        week = self.week(ep)
        nights = sorted(n for n in self.episodes if self.week(n) == week)
        if len(nights) == 1:
            return f"Week {week}"
        return f"Week {week}, night {nights.index(ep) + 1}"

    def url(self, ep: int) -> str:
        return f"{os.environ['DWTS_URL']}/episode/?season={self.id}&ep={ep:02d}"

    def scores(self, eps: list[int]) -> dict[int, list[dict]]:
        by_pk = query_partitions("SCORES_TABLE", [self.pk(n) for n in eps])
        return {n: by_pk[self.pk(n)] for n in eps}

    def players(self) -> set[str]:
        """Everyone who has scored this season, had a dance counted in any DWTS season,
        or is in a group that plays DWTS."""
        played = {
            score_owner(r)[1] for rows in self.scores(list(self.episodes)).values() for r in rows
        }
        return played | set(board_dynamo.rows("dwts", board_dynamo.ALL)) | members_playing("dwts")


class Traitors:
    """One current Traitors season of one edition."""

    show = "traitors"

    def __init__(self, edition: str, number: int):
        self.edition = edition
        self.number = number
        self.id = f"{edition}-{number}"
        rows = season_rows(edition, number)
        self.meta = next(r for r in rows if r["sk"] == "META")
        self.tz = EDITIONS[edition]["tz"]
        self.episodes = {ep_number(r): r for r in rows if r["sk"].startswith("EP#")}
        self.releases = {
            n: datetime.fromisoformat(e["releaseAt"]).astimezone(UTC)
            for n, e in self.episodes.items()
        }

    def pk(self, ep: int) -> str:
        return episode_pk(self.edition, self.number, ep)

    def label(self, eps: list[int]) -> str:
        return EDITION_LABEL[self.edition] + ep_span(eps)

    def url(self, ep: int) -> str:
        return f"{os.environ['TRAITORS_URL']}/episode/?ep={ep}&season={self.id}"

    def nights(self) -> list[list[int]]:
        """Episodes grouped by the local date they release on, in order."""
        zone = ZoneInfo(self.tz)
        by_day: dict[str, list[int]] = {}
        for n in sorted(self.episodes):
            by_day.setdefault(self.releases[n].astimezone(zone).date().isoformat(), []).append(n)
        return list(by_day.values())

    def picks(self, eps: list[int]) -> dict[int, list[dict]]:
        by_pk = query_partitions("SCORES_TABLE", [self.pk(n) for n in eps])
        return {n: by_pk[self.pk(n)] for n in eps}

    def players(self) -> set[str]:
        """Everyone with a pick or a winner bet this season, points in any season of the
        edition, or a place in a group that plays The Traitors."""
        picked = {
            pick_owner(r)[1] for rows in self.picks(list(self.episodes)).values() for r in rows
        }
        bets = query_all(table("SCORES_TABLE"), f"WIN#{self.edition}#{self.number}")
        return (
            picked
            | {b["sk"].removeprefix("USER#") for b in bets}
            | set(board_dynamo.rows(self.edition, board_dynamo.ALL))
            | members_playing("traitors")
        )


def seasons() -> list[Dwts | Traitors]:
    out: list[Dwts | Traitors] = [Dwts(n) for n in current_seasons("dwts")]
    for edition in EDITIONS:
        out += [Traitors(edition, n) for n in current_seasons(edition)]
    return out
