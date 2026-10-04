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

from lambdas.common.traitors_recap import written

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


def recap(episode: dict, results_by: dict[str, dict], players: list[dict]) -> dict | None:
    """The wiki's recap, else one written from the confirmed results."""
    if episode.get("recap"):
        return episode["recap"]
    who = {player_id(p): p["name"] for p in players}
    return written({k: shown(r) for k, r in results_by.items()}, who)


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
        "recap": recap(episode, results_by, players) if seen(sub, meta, episode, picks) else None,
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


def recruited_at(pid: str, stored: dict[int, list[dict]]) -> int | None:
    """The night a player was recruited, from the confirmed RECRUIT rows in `stored`."""
    nights = [
        n
        for n, rows in stored.items()
        for r in rows
        if r["sk"] == "EVT#RECRUIT" and pid in (result(r) or {}).get("recruits", [])
    ]
    return min(nights, default=None)


def traitor_from(
    sub: str,
    meta: dict,
    episodes: list[dict],
    player: dict,
    stored: dict[int, list[dict]],
    picks: dict[int, list[dict]],
) -> int | None:
    """
    The episode a player became a Traitor, if the caller may know they were one: 1 for
    an original, the episode whose night recruited them for a recruit, never for an
    Accomplice. A current season tells only once a banishment the caller has seen
    revealed them: before that, a murder list, even an empty one, would give away their
    side. Arguments as for `story`.
    """
    if player.get("faction") != "Traitor":
        return None
    if meta.get("current"):
        gone = player.get("exit")
        if not gone or gone["how"] != "banished":
            return None
        ep = int(gone["ep"])
        if not any(ep_number(e) == ep and seen(sub, meta, e, picks.get(ep, [])) for e in episodes):
            return None
    return recruited_at(player_id(player), stored) or 1


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
    exit): whom they voted for, the votes they drew, a shield, how they left, and for a
    Traitor whom they murdered and recruited. `stored` and `picks` map an episode to its
    performances and scores rows. A current season stops at the first episode the
    caller hasn't seen, so a missing episode can't hint that the player is out.

    `murdered` is who was found dead at that episode's breakfast, decided the night
    before; `recruited` is that night's recruits. Both are null unless the player was a
    Traitor then and the caller may know it (traitor_from): an original all season, a
    recruit from the episode after the night that recruited them. `recruited` is also
    null in the episode they left, since that night went on without them.
    """
    pid = player_id(player)
    gone = player.get("exit")
    traitor = traitor_from(sub, meta, episodes, player, stored, picks) is not None
    night = recruited_at(pid, stored) or 0
    out = []
    for e in episodes:
        n = ep_number(e)
        if meta.get("current") and not seen(sub, meta, e, picks.get(n, [])):
            break
        rows = {r["sk"].removeprefix("EVT#"): r for r in stored.get(n, [])}
        rt = shown(rows.get("RT"))
        held = result(rows.get("SHIELD"))
        killed = result(rows.get("MURDER"))
        recruits = result(rows.get("RECRUIT"))
        acting = traitor and n > night
        last = bool(gone) and int(gone["ep"]) == n
        out.append(
            {
                "ep": n,
                "title": e.get("title"),
                "voted": rt and rt.get("ballots", {}).get(pid),
                "votesReceived": rt and rt["firstVote"].get(pid, 0),
                "shield": bool(held) and pid in held["shields"],
                "out": {"how": gone["how"]} if last else None,
                "murdered": killed["victims"] if acting and killed else None,
                "recruited": recruits["recruits"] if acting and recruits and not last else None,
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
