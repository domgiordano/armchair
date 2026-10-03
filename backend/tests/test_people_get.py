"""/people/get against moto with season 8 seeded end to end. Replayed as the
current season, every dance goes through the gate, so a dance the caller hasn't
answered never carries a judge's value or anyone's score, and a result waits on
the episode rule. As the past season it is, all of it shows."""

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from lambdas.people_get import handler as people_get
from lambdas.people_get.handler import handler
from lambdas.scores_reveal_all.handler import handler as reveal_all_handler
from lambdas.scores_submit.handler import handler as submit_handler
from scripts.seed_season import SEASONS, items, publish_all, write
from scripts.seed_season import people as person_index
from tests.conftest import CATALOG_TABLE
from tests.events import authorized_event
from tests.seasons import as_current, close
from tests.social import A, B, accept, ask, call, post

S8 = json.loads((SEASONS / "dwts-8.json").read_text(), parse_float=Decimal)
LOCKED = {"season", "ep", "week", "key", "style", "song", "dancers", "locked"}
# Denise Richards and Maksim Chmerkovskiy danced episodes 1, 2, 4 and 5 and went out in 5.
DENISE = [1, 2, 4, 5]
EP1 = next(e for e in S8["episodes"] if e["ep"] == 1)
DENISE_EP1 = next(p for p in EP1["performances"] if p["contestants"] == ["denise-richards"])


@pytest.fixture
def seeded(aws):
    table = aws.Table(CATALOG_TABLE)
    write(table, items(as_current(S8)))
    write(table, person_index([S8], {}))
    publish_all(S8)
    return aws


def get(pid, sub=A, **params) -> tuple[int, dict]:
    return call(handler, authorized_event(path="/people/get", sub=sub, query={"id": pid, **params}))


def data(pid, sub=A, **params) -> dict:
    status, body = get(pid, sub, **params)
    assert status == 200, body
    return body["data"]


def answer(sub, ep, cid, value):
    body = {"season": "dwts-8", "ep": f"{ep:02d}", "contestant": cid, "n": 1, "value": value}
    status, res = post(submit_handler, "/scores/submit", sub, body)
    assert status == 200, res


def finish(sub, *eps):
    for ep in eps:
        status, res = post(
            reveal_all_handler, "/scores/reveal-all", sub, {"season": "dwts-8", "ep": f"{ep:02d}"}
        )
        assert status == 200, res


@pytest.mark.parametrize("pid", ["", "Derek", "derek--hough", "a" * 81, "x/y"])
def test_id_must_be_a_slug(seeded, pid):
    status, body = get(pid)
    assert status == 400
    assert body["error"]["detail"] == {"field": "id"}


def test_unknown_person_is_404(seeded):
    assert get("nobody-here")[0] == 404


def test_nothing_answered_shows_only_what_the_pre_show_table_does(seeded):
    denise = data("denise-richards")
    assert denise["name"] == "Denise Richards"
    assert denise["roles"] == ["celebrity"]
    assert [r["ep"] for r in denise["performances"]] == DENISE
    for row in denise["performances"]:
        assert set(row) == LOCKED and row["locked"] is True
    assert denise["performances"][0]["dancers"] == [
        {"id": "denise-richards", "name": "Denise Richards", "role": "celebrity"},
        {"id": "maksim-chmerkovskiy", "name": "Maksim Chmerkovskiy", "role": "pro"},
    ]
    (season,) = denise["seasons"]
    assert season["result"] == {"locked": True, "season": "dwts-8", "ep": 1}
    assert (season["dances"], season["locked"]) == (4, 4)
    stats = denise["stats"]["dancer"]
    assert stats["judges"] == {"count": 0, "mean": None}
    assert stats["best"] is None and stats["everyone"] == {"count": 0, "mean": None}


def test_answering_opens_that_dance_and_no_other(seeded):
    answer(B, 1, "denise-richards", 9)
    answer(B, 2, "denise-richards", 4)
    answer(A, 1, "denise-richards", 7)
    rows = data("denise-richards")["performances"]
    first, second = rows[0], rows[1]

    values = [float(v) for v in DENISE_EP1["judges"]]
    assert first["locked"] is False
    assert [j["value"] for j in first["judges"]] == values
    assert first["panelMean"] == round(sum(values) / len(values), 2)
    assert first["mine"] == {"value": 7}
    assert first["everyone"] == {"count": 2, "mean": 8.0}
    assert first["friends"] == {"count": 0, "mean": None}
    # B scored episode 2; A hasn't, so nothing of it leaks.
    assert set(second) == LOCKED

    stats = data("denise-richards")["stats"]["dancer"]
    assert stats["mine"] == {"count": 1, "mean": 7.0, "gap": round(7 - first["panelMean"], 2)}
    assert stats["locked"] == 3


def test_friends_average_counts_accepted_friends_only(seeded, people):
    answer(B, 1, "denise-richards", 9)
    answer(A, 1, "denise-richards", 7)
    ask(A, B)
    assert data("denise-richards")["performances"][0]["friends"]["count"] == 0
    accept(B, A)
    assert data("denise-richards")["performances"][0]["friends"] == {"count": 1, "mean": 9.0}


def test_a_result_waits_for_every_episode_up_to_it(seeded):
    finish(A, 1, 2, 3, 4)
    denise = data("denise-richards")["seasons"][0]["result"]
    melissa = data("melissa-rycroft")["seasons"][0]["result"]
    # Out in 5 or never out: the nudge is the same, so it says nothing.
    assert denise == melissa == {"locked": True, "season": "dwts-8", "ep": 5}

    finish(A, 5)
    assert data("denise-richards")["seasons"][0]["result"] == {"status": "out", "ep": 5, "week": 3}
    assert data("melissa-rycroft")["seasons"][0]["result"]["locked"] is True

    finish(A, *range(6, 16))
    # Replayed as current, the season isn't over; closed, she made the finale.
    assert data("melissa-rycroft")["seasons"][0]["result"] == {"status": "dancing"}


def test_a_past_season_shows_every_dance_and_result_unanswered(seeded):
    answer(B, 1, "denise-richards", 9)
    close(seeded, S8)
    denise = data("denise-richards")
    rows = denise["performances"]
    assert [r["ep"] for r in rows] == DENISE
    assert not any(r["locked"] for r in rows)
    values = [float(v) for v in DENISE_EP1["judges"]]
    assert [j["value"] for j in rows[0]["judges"]] == values
    assert rows[0]["mine"] is None and rows[0]["everyone"] == {"count": 1, "mean": 9.0}
    (season,) = denise["seasons"]
    assert season["result"] == {"status": "out", "ep": 5, "week": 3}
    assert (season["dances"], season["locked"]) == (4, 0)
    stats = denise["stats"]["dancer"]
    assert stats["locked"] == 0 and stats["judges"]["count"] == 4
    assert stats["mine"]["count"] == 0
    assert data("melissa-rycroft")["seasons"][0]["result"] == {"status": "finalist"}
    assert all(not r["locked"] for r in data("carrie-ann-inaba")["judged"]["rows"])
    assert (season["place"], season["cast"]) == (12, 13)


def test_the_current_season_never_carries_a_place(seeded):
    # The index holds season 8's places, but season 8 is replayed as current.
    finish(A, 1, 2, 3, 4, 5)
    (season,) = data("denise-richards")["seasons"]
    assert season["result"] == {"status": "out", "ep": 5, "week": 3}
    assert "place" not in season and "cast" not in season
    assert all("place" not in s for s in data("shawn-johnson", brief="1")["seasons"])


def test_brief_reads_who_they_are_and_no_dances(seeded):
    close(seeded, S8)
    maks = data("maksim-chmerkovskiy", brief="1")
    assert maks["name"] == "Maksim Chmerkovskiy"
    assert maks["performances"] == [] and maks["stats"] == {"dancer": None, "judge": None}
    (season,) = maks["seasons"]
    assert season["loaded"] is False and season["result"] is None
    assert season["partners"][0]["id"] == "denise-richards"
    assert (season["place"], season["cast"]) == (12, 13)


def test_a_judge_season_names_the_couple_they_scored_highest(seeded):
    close(seeded, S8)
    seasons = data("carrie-ann-inaba")["stats"]["judge"]["bySeason"]
    (s8,) = seasons
    top = s8["top"]
    assert top["count"] > 0
    assert {d["role"] for d in top["dancers"]} == {"celebrity", "pro"}
    # Nobody she scored that season averaged higher from her.
    by_couple = {}
    for e in S8["episodes"]:
        for p in e.get("performances") or []:
            if len(p["contestants"]) == 1 and p["judges"] and p["judges"][0] is not None:
                by_couple.setdefault(p["contestants"][0], []).append(float(p["judges"][0]))
    best = max(sum(v) / len(v) for v in by_couple.values())
    assert top["mean"] == round(best, 2)


def test_a_pro_sees_their_partners_dances(seeded):
    maks = data("maksim-chmerkovskiy")
    assert maks["roles"] == ["pro"]
    assert [r["key"] for r in maks["performances"]] == [
        f"denise-richards#{n}" for n in (1, 1, 1, 2)
    ]
    (denise,) = maks["seasons"][0]["partners"]
    assert (denise["id"], denise["name"]) == ("denise-richards", "Denise Richards")


def test_a_judge_gets_their_nights_and_tendencies_over_answered_dances(seeded):
    carrie = data("carrie-ann-inaba")
    assert carrie["roles"] == ["judge"]
    assert carrie["performances"] == []
    assert carrie["stats"]["dancer"] is None
    judged = carrie["judged"]
    assert judged["season"] == "dwts-8"
    assert all(set(r) == LOCKED for r in judged["rows"])
    assert carrie["stats"]["judge"]["count"] == 0
    assert carrie["stats"]["judge"]["distribution"] == {}

    answer(A, 1, "denise-richards", 9)
    judge = data("carrie-ann-inaba")["stats"]["judge"]
    mine = float(DENISE_EP1["judges"][0])
    rest = [float(v) for v in DENISE_EP1["judges"][1:]]
    assert judge["count"] == 1
    assert judge["mean"] == mine
    assert judge["vsPanel"] == round(mine - sum(rest) / 2, 2)
    assert judge["distribution"] == {f"{mine:g}": 1}
    assert judge["byStyle"] == [{"style": DENISE_EP1["style"], "count": 1, "mean": mine}]
    assert judge["mine"] == {"count": 1, "gap": round(9 - mine, 2), "mae": round(abs(9 - mine), 2)}


def test_season_narrows_the_lists_not_the_numbers(seeded):
    answer(A, 1, "denise-richards", 7)
    other = data("denise-richards", season="dwts-9")
    assert other["performances"] == []
    assert other["stats"]["dancer"]["mine"]["count"] == 1
    assert get("denise-richards", season="nope")[0] == 400


S35 = json.loads((SEASONS / "dwts-35.json").read_text(), parse_float=Decimal)


def test_the_current_season_lists_only_aired_nights(aws, monkeypatch):
    table = aws.Table(CATALOG_TABLE)
    write(table, items(S35))
    write(table, person_index([S35], {}))
    # Between episode 3 (9/22) and episode 4 (9/29), Eastern.
    monkeypatch.setattr(people_get, "_now", lambda: datetime(2026, 9, 25, tzinfo=UTC))
    tyler = data("tyler-cameron")
    assert sorted({r["ep"] for r in tyler["performances"]}) == [1, 3]
    assert all(set(r) == LOCKED for r in tyler["performances"])
    assert tyler["seasons"][0]["result"] == {"locked": True, "season": "dwts-35", "ep": 1}
    judged = data("bruno-tonioli")["judged"]
    assert judged["season"] == "dwts-35"
    assert {r["ep"] for r in judged["rows"]} == {1, 2, 3}


SEVEN = [
    json.loads((SEASONS / f"dwts-{n}.json").read_text(), parse_float=Decimal) for n in (5, 6, 7)
]
S7 = SEVEN[-1]


@pytest.fixture
def long_career(seeded):
    table = seeded.Table(CATALOG_TABLE)
    for season in SEVEN:
        write(table, items(season))
    publish_all(S7)
    write(table, person_index([*SEVEN, S8], {}))
    return seeded


def test_a_long_career_reads_only_seasons_the_caller_touched(long_career):
    carrie = data("carrie-ann-inaba")
    loaded = {e["number"]: e["loaded"] for e in carrie["seasons"]}
    # Only the latest of four seasons, until the caller scores another.
    assert loaded == {5: False, 6: False, 7: False, 8: True}
    assert carrie["judged"]["season"] == "dwts-8"

    # Scored while season 7 was current, then the season closed.
    write(long_career.Table(CATALOG_TABLE), items(as_current(S7)))
    ep = next(e for e in S7["episodes"] if e["ep"] == 1)
    cid = ep["performances"][0]["contestants"][0]
    body = {"season": "dwts-7", "ep": "01", "contestant": cid, "n": 1, "value": 8}
    assert post(submit_handler, "/scores/submit", A, body)[0] == 200
    close(long_career, S7)
    carrie = data("carrie-ann-inaba")
    assert {e["number"] for e in carrie["seasons"] if e["loaded"]} == {7, 8}
    # Season 7 is open, so every dance she judged in it counts, not only the one scored.
    assert carrie["stats"]["judge"]["count"] > 1
    assert carrie["stats"]["judge"]["mine"]["count"] == 1
    # The judged list stays on the latest season; asking for another lists that one.
    assert carrie["judged"]["season"] == "dwts-8"
    assert data("carrie-ann-inaba", season="dwts-5")["judged"]["season"] == "dwts-5"


def test_show_picks_whose_seasons_are_read(seeded):
    tus = {**S8, "show": "tus"}
    write(seeded.Table(CATALOG_TABLE), items(tus))
    write(seeded.Table(CATALOG_TABLE), person_index([tus], {}))
    denise = data("denise-richards", show="tus")
    assert [(e["season"], e["loaded"]) for e in denise["seasons"]] == [("tus-8", True)]
    assert {r["season"] for r in denise["performances"]} == {"tus-8"}
    assert data("denise-richards")["seasons"][0]["season"] == "dwts-8"


def test_unknown_show_is_400(seeded):
    status, body = get("denise-richards", show="traitors")
    assert status == 400
    assert body["error"]["detail"] == {"field": "show"}
