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
        keys = {f"{p['contestants'][0]}#{p['n']}" for p in e["performances"] if p["rateable"]}
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
