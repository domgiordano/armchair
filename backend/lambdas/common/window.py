"""
When an episode takes answers: from the moment it airs until the next episode
of the season airs, and the last one for LAST after it airs. A past season
(gate.is_open) takes none. A closed episode is gated like a past season, so
unanswered dances stay missed and the results open. Rules:
docs/features/dwts-companion/PLAN.md, "Gating rule (server-side)" rule 8.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from lambdas.common.api import ConflictError
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk
from lambdas.common.gate import answered, is_open, rateable

# The broadcast slot when the catalog has a date but no start time.
DEFAULT_START = "20:00"
LAST = timedelta(days=7)

Span = tuple[datetime | None, datetime | None]


def now() -> datetime:
    return datetime.now(UTC)


def airs_at(episode: dict, tz: ZoneInfo) -> datetime | None:
    if not episode.get("airDate"):
        return None
    start = episode.get("start") or DEFAULT_START
    # replace() picks the zone's offset for that date, so EDT and EST both come out right.
    return datetime.fromisoformat(f"{episode['airDate']}T{start}").replace(tzinfo=tz)


def spans(meta: dict, rows: Iterable[dict]) -> dict[int, Span]:
    """(opens, closes) per episode number, from a season's catalog rows."""
    tz = ZoneInfo(meta["timezone"])
    eps = sorted(
        (int(r["sk"].removeprefix("EP#")), airs_at(r, tz))
        for r in rows
        if r["sk"].startswith("EP#")
    )
    out = {}
    for i, (n, opens) in enumerate(eps):
        after = eps[i + 1][1] if i + 1 < len(eps) else None
        # A next episode without a date yet closes this one like a finale.
        closes = after or (opens and opens + LAST)
        out[n] = (opens, closes)
    return out


def is_live(meta: dict, span: Span, at: datetime) -> bool:
    opens, closes = span
    return not is_open(meta) and opens is not None and opens <= at < closes


def closed(meta: dict, span: Span, at: datetime) -> bool:
    """Past answering: the gate shows the episode whole, as it does a past season."""
    return is_open(meta) or (span[1] is not None and at >= span[1])


def iso(t: datetime | None) -> str | None:
    return t and t.astimezone(UTC).isoformat(timespec="minutes").replace("+00:00", "Z")


def view(meta: dict, span: Span, at: datetime) -> dict:
    return {"opensAt": iso(span[0]), "closesAt": iso(span[1]), "open": is_live(meta, span, at)}


def require_live(meta: dict, span: Span, at: datetime) -> None:
    """409 for a write to an episode not taking answers. A past season is the caller's 403."""
    if is_live(meta, span, at):
        return
    late = span[0] is not None and at >= span[0]
    raise ConflictError(
        "This episode closed for scoring" if late else "This episode isn't open for scoring yet",
        code="episode_closed" if late else "episode_not_open",
        opensAt=iso(span[0]),
        closesAt=iso(span[1]),
    )


def active(meta: dict, all_spans: dict[int, Span], at: datetime) -> int | None:
    return next((n for n, s in sorted(all_spans.items()) if is_live(meta, s, at)), None)


def progress(
    sub: str, show: str, season: int, n: int, episode: dict, contestants: list[dict], span: Span
) -> dict:
    """activeEpisode for a handler without the episode's rows in hand: two reads."""
    pk = episode_pk(show, season, n)
    perfs, score_rows = query_many([("PERFORMANCES_TABLE", pk), ("SCORES_TABLE", pk)])
    keys = rateable(n, episode, contestants, perfs)
    done = answered(sub, score_rows)
    return summary(n, pk, span, len(keys), sum(k in done for k in keys))


def summary(n: int, pk: str, span: Span, total: int, done: int) -> dict:
    return {
        "ep": n,
        "pk": pk,
        "opensAt": iso(span[0]),
        "closesAt": iso(span[1]),
        "answered": done,
        "rateable": total,
    }
