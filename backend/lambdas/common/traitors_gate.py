"""
The only code that decides what a caller may see of Traitors picks and results.
Rules and their reasons: docs/features/traitors/PLAN.md, "Gate".

Inputs are raw DynamoDB items; nothing here reads a table.
- catalog `SEASON#{show}#{n}`: META, `EP#{nn}` (releaseAt, noRoundTable, recap),
  `PLAYER#{id}` (`exit: {ep, how}` once the poller writes it).
- performances `EP#{show}#{n}#{nn}`: `EVT#{type}` with `state` and the result fields
  (RT: banished, faction, firstVote, and the notes ballots, daggers; MURDER: victims;
  RECRUIT: recruits; SHIELD: shields). Only a `confirmed` row is a result.
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
    "SHIELD": ("shields",),
}
# Shown with a result but never scored: board signatures are over RESULT_FIELDS only.
NOTES = {"RT": ("ballots", "daggers")}


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


def card(player: dict) -> dict:
    """What any caller may see of a player: no faction, no exit."""
    shot = player.get("headshot")
    return {"id": player_id(player), "name": player["name"], "headshot": shot and shot["image"]}


def credit(headshot: dict) -> dict:
    """A headshot's attribution. Commons gives an author and license; other sources may not."""
    return {k: headshot.get(k) for k in ("source", "sourceUrl", "author", "license")}


def roster(ep: int, players: list[dict]) -> list[dict]:
    """
    Players still in at the start of episode `ep`. Someone murdered or banished in `ep`
    is still a pick for it. This reveals exits from earlier episodes, the same accepted
    leak as DWTS's roster.
    """
    return [
        card(p)
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


def shown(row: dict | None) -> dict | None:
    """A confirmed result with its notes, for display."""
    out = result(row)
    if out is None:
        return None
    return out | {k: row[k] for k in NOTES.get(row["sk"].removeprefix("EVT#"), ()) if k in row}


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
    closed. A group narrows the people shown; it never opens a locked event. The recap
    tells the whole episode, so it waits for every event to be answered.
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
            card["result"] = shown(results_by.get(kind))
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
        "recap": episode.get("recap") if seen(sub, meta, episode, picks) else None,
        "roster": roster(ep, players),
        "events": cards,
    }


def released(episodes: list[dict], t: int) -> int:
    stamp = datetime.fromtimestamp(t, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return sum(e["releaseAt"] <= stamp for e in episodes)


def shut(meta: dict, episodes: list[dict]) -> set[int]:
    return {ep_number(e) for e in episodes if closed(meta, e)}


def bet_roster(meta: dict, episodes: list[dict], players: list[dict]) -> list[dict]:
    """
    Who the winner bet may name: everyone not out in a closed episode. Exits in episodes
    the caller can still pick stay hidden, so a late bet may name someone already gone.
    """
    gone = shut(meta, episodes)
    return [
        card(p)
        for p in sorted(players, key=lambda p: p["name"])
        if not p.get("exit") or int(p["exit"]["ep"]) not in gone
    ]


def wall(meta: dict, episodes: list[dict], players: list[dict]) -> list[dict]:
    """
    The whole cast with exits crossed out. In a current season an exit, and the faction
    it revealed, shows only from a closed episode, the same line bet_roster draws. A past
    season shows every exit and faction.
    """
    current = bool(meta.get("current"))
    gone = shut(meta, episodes)
    cast = []
    for p in sorted(players, key=lambda p: p["name"]):
        left = bool(p.get("exit")) and (not current or int(p["exit"]["ep"]) in gone)
        cast.append(
            {
                **card(p),
                "faction": p.get("faction") if left or not current else None,
                "exit": p["exit"] if left else None,
            }
        )
    return cast


def answered(sub: str, episode: dict, picks: list[dict]) -> bool:
    """Every event of the episode picked or forfeited by the caller: gate rule 2."""
    return set(mine(sub, picks)) >= set(events(episode))


def seen(sub: str, meta: dict, episode: dict, picks: list[dict]) -> bool:
    """The whole episode is the caller's to see: closed, or every event answered."""
    return closed(meta, episode) or answered(sub, episode, picks)


def story(
    sub: str,
    meta: dict,
    episodes: list[dict],
    player: dict,
    stored: dict[int, list[dict]],
    picks: dict[int, list[dict]],
) -> list[dict]:
    """
    One player's season an episode at a time, over `episodes` (released, up to their
    exit): whom they voted for, the votes they drew, a shield, and how they left.
    `stored` and `picks` map an episode to its performances and scores rows. A current
    season stops at the first episode the caller hasn't seen, so a missing episode
    can't hint that the player is out.
    """
    pid = player_id(player)
    gone = player.get("exit")
    out = []
    for e in episodes:
        n = ep_number(e)
        if meta.get("current") and not seen(sub, meta, e, picks.get(n, [])):
            break
        rows = {r["sk"].removeprefix("EVT#"): r for r in stored.get(n, [])}
        rt = shown(rows.get("RT"))
        held = result(rows.get("SHIELD"))
        out.append(
            {
                "ep": n,
                "title": e.get("title"),
                "voted": rt and rt.get("ballots", {}).get(pid),
                "votesReceived": rt and rt["firstVote"].get(pid, 0),
                "shield": bool(held) and pid in held["shields"],
                "out": {"how": gone["how"]} if gone and int(gone["ep"]) == n else None,
            }
        )
    return out


def out(
    sub: str,
    meta: dict,
    episodes: list[dict],
    players: list[dict],
    ep: int,
    earlier: dict[int, list[dict]],
) -> list[dict]:
    """
    Exits in episodes before `ep` whose results the caller may see, closed or fully
    answered, so their seats can be crossed out. `earlier` maps each of those episodes
    to its scores rows. The roster already drops them; this says how they left.
    """
    seen = {
        ep_number(e)
        for e in episodes
        if ep_number(e) < ep
        and (closed(meta, e) or answered(sub, e, earlier.get(ep_number(e), [])))
    }
    return [
        {
            "id": player_id(p),
            "ep": int(p["exit"]["ep"]),
            "how": p["exit"]["how"],
            "faction": p.get("faction"),
        }
        for p in sorted(players, key=lambda p: p["name"])
        if p.get("exit") and int(p["exit"]["ep"]) in seen
    ]
