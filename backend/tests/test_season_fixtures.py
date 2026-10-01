import json

import pytest

from scripts.build_season import SEASONS

PAST = [json.loads((SEASONS / f"dwts-{n}.json").read_text()) for n in range(1, 35)]


@pytest.mark.parametrize("season", PAST, ids=lambda s: f"dwts-{s['season']}")
def test_every_fixture_is_consistent(season):
    cids = {c["id"] for c in season["contestants"]}
    judges = {j["id"] for j in season["judges"]}
    assert set(season["defaultPanel"]) <= judges
    assert [e["ep"] for e in season["episodes"]] == list(range(1, len(season["episodes"]) + 1))
    for e in season["episodes"]:
        # Every dance in a fixture was scored on the show, so every one is rateable.
        assert all(p["rateable"] for p in e["performances"])
        keys = {f"{'+'.join(p['contestants'])}#{p['n']}" for p in e["performances"]}
        assert set(e["rateableKeys"]) == keys and e["rateableKeys"]
        for p in e["performances"]:
            panel = p.get("panel", e["panel"])
            assert set(panel) <= judges and set(p["contestants"]) <= cids
            assert len(p["judges"]) == len(panel)
            assert sum(v for v in p["judges"] if v is not None) == p["total"]
    last = len(season["episodes"])
    assert all(1 <= c["eliminatedEp"] <= last for c in season["contestants"] if c["eliminatedEp"])
    aliases = [a for c in season["contestants"] for a in c["aliases"]]
    assert len(aliases) == len(set(aliases))


def test_team_dances_are_keyed_by_every_member_and_rateable():
    s34 = next(s for s in PAST if s["season"] == 34)
    wk8 = next(e for e in s34["episodes"] if e["week"] == 8)
    assert "danielle-fishel+whitney-leavitt+jordan-chiles+dylan-efron#1" in wk8["rateableKeys"]
    assert wk8["dancesPerCouple"] == 1
