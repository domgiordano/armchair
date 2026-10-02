import pytest

from lambdas.traitors_episode.handler import handler as episode_handler
from lambdas.traitors_pick.handler import handler as pick_handler
from lambdas.traitors_season.handler import handler as season_handler
from lambdas.traitors_winner.handler import handler as winner_handler
from tests.conftest import CATALOG_TABLE, GROUPS_TABLE, PERFORMANCES_TABLE
from tests.events import authorized_event
from tests.social import A, B, C, call, post

PK = "SEASON#tus#5"
SEASON = "tus-5"
# Ep 1 aired before the season opened in the app; 2 and 3 are pickable.
OPEN_AT = "2026-10-01T00:00:00Z"
PLAYERS = ["ann", "bob", "cat", "dan", "eve"]


@pytest.fixture
def db(aws):
    t = aws.Table(CATALOG_TABLE)
    t.put_item(
        Item={"pk": PK, "sk": "META", "current": True, "openAt": OPEN_AT, "wikiTitle": "New Blood"}
    )
    t.put_item(
        Item={"pk": "SEASONS#tus", "sk": "SEASON#005", "id": SEASON, "number": 5, "current": True}
    )
    for n, release, no_rt in (
        (1, "2026-09-18T00:00:00Z", True),
        (2, "2026-10-01T12:00:00Z", False),
        (3, "2099-01-01T00:00:00Z", False),
    ):
        t.put_item(
            Item={
                "pk": PK,
                "sk": f"EP#{n:02d}",
                "releaseAt": release,
                "noRoundTable": no_rt,
                "title": f"Ep {n}",
            }
        )
    for p in PLAYERS:
        t.put_item(Item={"pk": PK, "sk": f"PLAYER#{p}", "name": p.title()})
    # Ann was murdered in the closed episode 1; Bob is banished in episode 2.
    t.update_item(
        Key={"pk": PK, "sk": "PLAYER#ann"},
        UpdateExpression="SET #e = :e",
        ExpressionAttributeNames={"#e": "exit"},
        ExpressionAttributeValues={":e": {"ep": 1, "how": "murdered"}},
    )
    t.update_item(
        Key={"pk": PK, "sk": "PLAYER#bob"},
        UpdateExpression="SET #e = :e",
        ExpressionAttributeNames={"#e": "exit"},
        ExpressionAttributeValues={":e": {"ep": 2, "how": "banished"}},
    )
    perf = aws.Table(PERFORMANCES_TABLE)
    perf.put_item(
        Item={
            "pk": "EP#tus#5#02",
            "sk": "EVT#RT",
            "state": "confirmed",
            "banished": "bob",
            "faction": "Faithful",
            "firstVote": {"bob": 3, "cat": 1},
        }
    )
    perf.put_item(
        Item={"pk": "EP#tus#5#02", "sk": "EVT#MURDER", "state": "provisional", "victims": ["dan"]}
    )
    return aws


def get(handler, path, sub, **params):
    return call(handler, authorized_event(path=path, sub=sub, query={"season": SEASON, **params}))


def bet(sub, picks=({"player": "cat", "faction": "Traitor"},)):
    return post(winner_handler, "/traitors/winner", sub, {"season": SEASON, "picks": list(picks)})


def pick(sub, event, picks=None, ep="02", **extra):
    body = {"season": SEASON, "ep": ep, "event": event, **extra}
    if picks is not None:
        body["picks"] = picks
    return post(pick_handler, "/traitors/pick", sub, body)


def cards(sub, ep="02", **params):
    status, res = get(episode_handler, "/traitors/episode", sub, ep=ep, **params)
    assert status == 200, res
    return {c["type"]: c for c in res["data"]["events"]}


def test_season_asks_for_the_bet_first(db):
    status, res = get(season_handler, "/traitors/season", A)
    assert status == 200
    data = res["data"]
    assert data["needsBet"] is True
    assert data["episodes"] == 3
    assert data["released"] == 2
    # Ann went out in a closed episode; Bob's exit is in an open one and stays hidden.
    assert [p["id"] for p in data["players"]] == ["bob", "cat", "dan", "eve"]
    assert "bet" not in data


def test_everything_else_waits_for_the_bet(db):
    assert get(episode_handler, "/traitors/episode", A, ep="02")[0] == 403
    status, res = pick(A, "MURDER", ["dan"])
    assert status == 403
    assert res["error"]["detail"]["needsBet"] is True


def test_bet_is_final_and_records_episodes_out(db):
    status, res = bet(
        A, [{"player": "cat", "faction": "Traitor"}, {"player": "eve", "faction": "Faithful"}]
    )
    assert status == 200
    assert res["data"]["released"] == 2
    assert bet(A)[0] == 409
    assert bet(A, [{"player": "ann", "faction": "Traitor"}])[0] in (400, 409)
    assert bet(B, [{"player": "ann", "faction": "Traitor"}])[0] == 400
    assert bet(B, [{"player": "cat", "faction": "Seer"}])[0] == 400
    assert bet(B, [{"player": "cat", "faction": "Traitor"}] * 2)[0] == 400


def test_locked_until_answered(db):
    bet(A)
    bet(B)
    pick(B, "RT", ["bob", "cat", "dan"])
    before = cards(A)
    assert list(before) == ["MURDER", "RT", "RECRUIT"]
    assert all(c["locked"] and "result" not in c and "consensus" not in c for c in before.values())

    assert pick(A, "RT", ["cat", "bob", "eve"])[0] == 200
    after = cards(A)
    assert after["RT"]["locked"] is False
    assert after["RT"]["result"] == {
        "banished": "bob",
        "faction": "Faithful",
        "firstVote": {"bob": 3, "cat": 1},
    }
    assert after["RT"]["consensus"] == {
        "voters": 2,
        "picks": {"bob": 2, "cat": 2, "dan": 1, "eve": 1},
        "first": {"bob": 1, "cat": 1},
    }
    assert after["MURDER"]["locked"] is True


def test_provisional_result_is_no_result(db):
    bet(A)
    pick(A, "MURDER", forfeit=True)
    assert cards(A)["MURDER"]["result"] is None


def test_picks_are_final(db):
    bet(A)
    assert pick(A, "MURDER", ["dan"])[0] == 200
    assert pick(A, "MURDER", ["dan"])[0] == 200
    assert pick(A, "MURDER", ["eve"])[0] == 409
    assert pick(A, "RECRUIT", forfeit=True)[0] == 200
    assert pick(A, "RECRUIT", ["eve"])[0] == 409


@pytest.mark.parametrize(
    "event,picks",
    [
        ("RT", ["cat", "dan"]),
        ("RT", ["cat", "cat", "dan"]),
        ("RT", ["ann", "cat", "dan"]),  # out before episode 2
        ("MURDER", ["nobody"]),
        ("MURDER", [1]),
        ("SEER", ["cat"]),
    ],
)
def test_bad_picks(db, event, picks):
    bet(A)
    assert pick(A, event, picks)[0] == 400


def test_round_table_not_offered_in_episode_one_style_eps(db):
    bet(A)
    t = db.Table(CATALOG_TABLE)
    t.update_item(
        Key={"pk": PK, "sk": "EP#03"},
        UpdateExpression="SET noRoundTable = :t",
        ExpressionAttributeValues={":t": True},
    )
    assert pick(A, "RT", ["cat", "dan", "eve"], ep="03")[0] == 400
    assert list(cards(A, ep="03")) == ["MURDER", "RECRUIT"]


def test_closed_episode_is_open_and_takes_no_picks(db):
    bet(A)
    assert pick(A, "MURDER", ["ann"], ep="01")[0] == 403
    view = cards(A, ep="01")
    assert all(not c["locked"] for c in view.values())


def test_finished_season_needs_no_bet_and_takes_none(db):
    db.Table(CATALOG_TABLE).update_item(
        Key={"pk": PK, "sk": "META"},
        UpdateExpression="SET #c = :f",
        ExpressionAttributeNames={"#c": "current"},
        ExpressionAttributeValues={":f": False},
    )
    assert all(not c["locked"] for c in cards(A).values())
    assert bet(A)[0] == 403
    assert pick(A, "MURDER", ["dan"])[0] == 403


def test_group_narrows_and_never_unlocks(db):
    for sub in (A, B, C):
        bet(sub)
    groups = db.Table(GROUPS_TABLE)
    for sub in (A, B):
        groups.put_item(Item={"pk": "GROUP#g1", "sk": f"MEMBER#{sub}"})
    pick(B, "MURDER", ["dan"])
    pick(C, "MURDER", ["eve"])
    assert cards(A, group="g1")["MURDER"]["locked"] is True
    pick(A, "MURDER", ["cat"])
    shown = cards(A, group="g1")["MURDER"]["group"]
    assert sorted(s["sub"] for s in shown) == sorted([A, B])
    assert get(episode_handler, "/traitors/episode", C, ep="02", group="g1")[0] == 403


def test_season_lists_my_progress(db):
    bet(A)
    pick(A, "MURDER", ["dan"])
    _, res = get(season_handler, "/traitors/season", A)
    eps = res["data"]["episodes"]
    assert [(e["ep"], e["closed"], e["events"], e["answered"]) for e in eps] == [
        (1, True, 2, 0),
        (2, False, 3, 1),
        (3, False, 3, 0),
    ]


def test_not_a_traitors_season(db):
    status, _ = call(
        episode_handler,
        authorized_event(path="/traitors/episode", sub=A, query={"season": "dwts-35", "ep": "01"}),
    )
    assert status == 400
