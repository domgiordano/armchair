"""
The only code that decides what a caller may see of Traitors picks and results.
Rules and their reasons: docs/features/traitors/PLAN.md, "Gate".

Inputs are raw DynamoDB items; nothing here reads a table.
- catalog `SEASON#{show}#{n}`: META, `EP#{nn}` (releaseAt, noRoundTable), `PLAYER#{id}`
  (`exit: {ep, how}` once the poller writes it).
- performances `EP#{show}#{n}#{nn}`: `EVT#{type}` with `state` and the result fields
  (RT: banished, faction, firstVote; MURDER: victims; RECRUIT: recruits). Only a
  `confirmed` row is a result.
- scores `EP#{show}#{n}#{nn}`: `EVT#{type}#USER#{sub}` holding `picks` or `forfeit`.
  scores `WIN#{show}#{n}`: `USER#{sub}` holding the winner bet.
"""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

# Show order: the breakfast reveal, the round table, then the night's recruitment.
EVENTS = ("MURDER", "RT", "RECRUIT")
PICKS = {"MURDER": 1, "RT": 3, "RECRUIT": 1}
RESULT_FIELDS = {
    "MURDER": ("victims",),
    "RT": ("banished", "faction", "firstVote"),
    "RECRUIT": ("recruits",),
}


def ep_number(item: dict) -> int:
    return int(item["sk"].removeprefix("EP#"))


def player_id(item: dict) -> str:
    return item["sk"].removeprefix("PLAYER#")


def closed(meta: dict, episode: dict) -> bool:
    """
    No picks, everything visible: a season no longer current, or an episode released
    before the season opened in the app (New Blood 1-4 at launch).
    """
    return not meta.get("current") or episode["releaseAt"] < meta["openAt"]


def needs_bet(meta: dict, bet: dict | None) -> bool:
    """A current season stays behind the winner-bet screen until the caller has one."""
    return bool(meta.get("current")) and bet is None


def events(episode: dict) -> list[str]:
    return [e for e in EVENTS if not (e == "RT" and episode.get("noRoundTable"))]


def roster(ep: int, players: list[dict]) -> list[dict]:
    """
    Players still in at the start of episode `ep`. Someone murdered or banished in `ep`
    is still a pick for it. This reveals exits from earlier episodes, the same accepted
    leak as DWTS's roster.
    """
    return [
        {"id": player_id(p), "name": p["name"]}
        for p in sorted(players, key=lambda p: p["name"])
        if not p.get("exit") or int(p["exit"]["ep"]) >= ep
    ]


def pick_owner(row: dict) -> tuple[str, str]:
    """(event type, sub) of a scores row."""
    kind, _, sub = row["sk"].removeprefix("EVT#").partition("#USER#")
    return kind, sub


def mine(sub: str, picks: list[dict]) -> dict[str, dict]:
    return {kind: row for row in picks for kind, owner in [pick_owner(row)] if owner == sub}


def result(row: dict | None) -> dict | None:
    if not row or row.get("state") != "confirmed":
        return None
    return {k: row[k] for k in RESULT_FIELDS[row["sk"].removeprefix("EVT#")] if k in row}


def consensus(kind: str, rows: list[dict]) -> dict:
    """Everyone's picks for one event, counted. Forfeits count toward nothing."""
    chosen = [r["picks"] for r in rows if r.get("picks")]
    out = {"voters": len(chosen), "picks": dict(Counter(p for picks in chosen for p in picks))}
    if kind == "RT":
        out["first"] = dict(Counter(picks[0] for picks in chosen))
    return out


def episode_view(
    sub: str,
    meta: dict,
    episode: dict,
    players: list[dict],
    results: list[dict],
    picks: list[dict],
    group: set[str] | None,
) -> dict:
    """
    One episode as the caller may see it. An event's result, consensus and group
    members' picks show once the caller has picked or forfeited it, or the episode is
    closed. A group narrows the people shown; it never opens a locked event.
    """
    ep = ep_number(episode)
    is_closed = closed(meta, episode)
    own = mine(sub, picks)
    by_kind: dict[str, list[dict]] = {}
    for row in picks:
        by_kind.setdefault(pick_owner(row)[0], []).append(row)
    results_by = {r["sk"].removeprefix("EVT#"): r for r in results}

    cards = []
    for kind in events(episode):
        row = own.get(kind)
        card = {
            "type": kind,
            "picks": PICKS[kind],
            "mine": row and {k: row[k] for k in ("picks", "forfeit", "submittedAt") if k in row},
            "locked": row is None and not is_closed,
        }
        if not card["locked"]:
            rows = by_kind.get(kind, [])
            card["result"] = result(results_by.get(kind))
            card["consensus"] = consensus(kind, rows)
            if group is not None:
                card["group"] = [
                    {"sub": owner, "picks": r.get("picks"), "forfeit": r.get("forfeit", False)}
                    for r in rows
                    for _, owner in [pick_owner(r)]
                    if owner in group
                ]
        cards.append(card)

    return {
        "ep": ep,
        "title": episode.get("title"),
        "releaseAt": episode["releaseAt"],
        "closed": is_closed,
        "roster": roster(ep, players),
        "events": cards,
    }


def released(episodes: list[dict], t: int) -> int:
    stamp = datetime.fromtimestamp(t, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return sum(e["releaseAt"] <= stamp for e in episodes)


def bet_roster(meta: dict, episodes: list[dict], players: list[dict]) -> list[dict]:
    """
    Who the winner bet may name: everyone not out in a closed episode. Exits in episodes
    the caller can still pick stay hidden, so a late bet may name someone already gone.
    """
    shut = {ep_number(e) for e in episodes if closed(meta, e)}
    return [
        {"id": player_id(p), "name": p["name"]}
        for p in sorted(players, key=lambda p: p["name"])
        if not p.get("exit") or int(p["exit"]["ep"]) not in shut
    ]
