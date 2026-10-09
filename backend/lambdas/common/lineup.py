"""
One night's dances for the admin running-order screen: every key the episode
asks for (gate.rateable) plus any the poller's lineup names, with who dances it
and where it sits now. cron_poll_wiki writes the lineup; admin_order sets it by hand.
"""

from __future__ import annotations

from lambdas.common.episodes_dynamo import catalog, episode_pk, performances
from lambdas.common.gate import cid, rateable


def night(show: str, season: int, ep: int) -> tuple[dict, list[dict]]:
    """(the EP item, its dances in their current order, unplaced ones last by name)."""
    _, episode, contestants = catalog(show, season, ep)
    perfs = performances(episode_pk(show, season, ep))
    lineup = episode.get("lineup") or {}
    names = {
        cid(c): next(m["name"] for m in c["members"] if m["role"] == "celebrity")
        for c in contestants
    }
    keys = list(dict.fromkeys(rateable(ep, episode, contestants, perfs) + list(lineup)))
    dances = []
    for key in keys:
        line = lineup.get(key, {})
        couples = key.rsplit("#", 1)[0].split("+")
        dances.append(
            {
                "key": key,
                "names": [names.get(c, c) for c in couples],
                "style": line.get("style"),
                "song": line.get("song"),
                "order": line.get("order"),
            }
        )
    dances.sort(key=lambda d: (d["order"] is None, d["order"] or 0, d["names"][0].casefold()))
    return episode, dances
