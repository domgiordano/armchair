"""
Turns a parsed Traitors season page into confirmed event results.

An event's result goes provisional the first time the page settles it, and confirms
once it has stayed the same for confirm.WINDOW seconds (common/confirm.py). What
"settles" means per event, and why a round table needs its full tally first:
docs/features/traitors/PLAN.md, "Results".

A performances `EVT#{type}` item: {state, value, firstSeenAt, rev} plus the result's
own fields, which are what the gate shows.
"""

from __future__ import annotations

from lambdas.common import confirm
from lambdas.common.dynamo import update
from lambdas.common.episodes_dynamo import episode_pk
from lambdas.common.people import slug

STEP = ("value", "state", "firstSeenAt", "rev")


def outcomes(parsed: dict, episodes: list[int]) -> dict[int, dict[str, dict | None]]:
    """
    Each episode's result per event, or None where the page can't settle it yet.

    - RT: the episode's first round table once complete (per-player votes match the Vote row).
    - MURDER: its victims, possibly none, once the round table after breakfast is in, or
      anything later in the season is.
    - RECRUIT: its recruits, possibly none, once anything later is in. The night is the
      last thing in an episode, so nothing inside it says the night is over.
    """
    factions = {p["name"]: (p["affiliation"] or [None])[-1] for p in parsed["contestants"]}
    rts: dict[int, dict] = {}
    for rt in parsed["roundTables"]:
        rts.setdefault(rt["ep"], rt)
    victims: dict[int, list[str]] = {}
    for m in parsed["murdered"]:
        victims.setdefault(m["ep"], []).append(slug(m["name"]))
    recruits: dict[int, list[str]] = {}
    for r in parsed["recruited"]:
        recruits.setdefault(r["ep"], []).append(slug(r["name"]))

    filled = {e for e, rt in rts.items() if rt["complete"]} | set(victims)
    done = bool(parsed["winners"])
    out = {}
    for e in episodes:
        later = done or any(x > e for x in filled)
        rt = rts.get(e)
        out[e] = {
            "RT": None,
            "MURDER": {"victims": victims.get(e, [])}
            if e in victims or e in filled or later
            else None,
            "RECRUIT": {"recruits": recruits.get(e, [])} if e in recruits or later else None,
        }
        if rt and rt["complete"]:
            out[e]["RT"] = {
                "banished": slug(rt["banished"]),
                "faction": factions.get(rt["banished"]),
                "firstVote": {slug(n): c for n, c in rt["firstVote"].items()},
            }
    return out


def winners(parsed: dict) -> dict[str, str]:
    """Each winner's id mapped to the faction they won as."""
    sides = {p["name"]: (p["affiliation"] or [None])[-1] for p in parsed["contestants"]}
    return {slug(n): sides.get(n) for n in parsed["winners"]}


def publish(
    show: str,
    season: int,
    ep: int,
    results: dict[str, dict | None],
    stored: list[dict],
    t: int,
    rev: int,
    window: int = confirm.WINDOW,
) -> tuple[bool, list[dict]]:
    """
    Steps each event of one episode and writes what changed. Returns (anything still
    provisional, the confirmed results). A result the page drops goes back to pending
    unless it already confirmed; confirmed results stay, as judges' values do in DWTS.
    """
    pk = episode_pk(show, season, ep)
    by_sk = {r["sk"]: r for r in stored if r.get("state") != "pending"}
    pending = False
    confirmed = []
    for kind, value in results.items():
        sk = f"EVT#{kind}"
        prev = by_sk.get(sk)
        if value is None:
            if prev and prev.get("state") == "provisional":
                update("PERFORMANCES_TABLE", {"pk": pk, "sk": sk}, {"state": "pending"})
            continue
        before = prev and {k: prev[k] for k in STEP}
        entry = confirm.step(before, value, t, rev, window)
        if entry != before:
            update("PERFORMANCES_TABLE", {"pk": pk, "sk": sk}, {**entry, **value})
        if entry["state"] == "confirmed":
            confirmed.append({"kind": kind, **value})
        else:
            pending = True
    return pending, confirmed


def exits(show: str, season: int, ep: int, confirmed: list[dict]) -> None:
    """Marks who left in this episode on their PLAYER item, with the faction a banishment revealed."""
    pk = f"SEASON#{show}#{season}"
    for r in confirmed:
        if r["kind"] == "RT":
            fields = {"exit": {"ep": ep, "how": "banished"}}
            if r.get("faction"):
                fields["faction"] = r["faction"]
            update("CATALOG_TABLE", {"pk": pk, "sk": f"PLAYER#{r['banished']}"}, fields)
        elif r["kind"] == "MURDER":
            for v in r["victims"]:
                update(
                    "CATALOG_TABLE",
                    {"pk": pk, "sk": f"PLAYER#{v}"},
                    {"exit": {"ep": ep, "how": "murdered"}},
                )
