from lambdas.common.traitors_board import reconcile, reconcile_winners
from tests.conftest import BOARD_TABLE, PERFORMANCES_TABLE, SCORES_TABLE

EP = "EP#tus#5#02"


def board(aws, season="5"):
    rows = aws.Table(BOARD_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": f"BOARD#tus#{season}"}
    )["Items"]
    return {
        r["sk"].removeprefix("USER#"): {k: int(v) for k, v in r.items() if k not in ("pk", "sk")}
        for r in rows
    }


def setup(aws):
    perf = aws.Table(PERFORMANCES_TABLE)
    perf.put_item(
        Item={
            "pk": EP,
            "sk": "EVT#RT",
            "state": "confirmed",
            "banished": "bob",
            "firstVote": {"bob": 3, "cat": 2, "dan": 1},
        }
    )
    perf.put_item(Item={"pk": EP, "sk": "EVT#MURDER", "state": "provisional", "victims": ["eve"]})
    s = aws.Table(SCORES_TABLE)
    s.put_item(Item={"pk": EP, "sk": "EVT#RT#USER#a", "picks": ["bob", "cat", "dan"]})
    s.put_item(Item={"pk": EP, "sk": "EVT#RT#USER#b", "picks": ["cat", "bob", "eve"]})
    s.put_item(Item={"pk": EP, "sk": "EVT#RT#USER#c", "forfeit": True})
    s.put_item(Item={"pk": EP, "sk": "EVT#MURDER#USER#a", "picks": ["eve"]})


def test_confirmed_events_count_once(aws):
    setup(aws)
    assert reconcile("tus", 5, 2) == 2
    assert reconcile("tus", 5, 2) == 0
    # A: 5 + 3 + 2. B: cat is in the top 3, bob too, eve isn't. The provisional murder waits.
    expected = {
        "a": {"pts": 10, "events": 1, "banishHits": 1},
        "b": {"pts": 2, "events": 1, "banishHits": 0},
    }
    assert board(aws) == expected
    assert board(aws, "all") == expected


def test_confirm_later_and_correction(aws):
    setup(aws)
    reconcile("tus", 5, 2)
    perf = aws.Table(PERFORMANCES_TABLE)
    perf.put_item(Item={"pk": EP, "sk": "EVT#MURDER", "state": "confirmed", "victims": ["eve"]})
    reconcile("tus", 5, 2)
    assert board(aws)["a"] == {"pts": 14, "events": 2, "banishHits": 1}
    # Wikipedia corrects the tally after confirming: cat and dan swap.
    perf.put_item(
        Item={
            "pk": EP,
            "sk": "EVT#RT",
            "state": "confirmed",
            "banished": "bob",
            "firstVote": {"bob": 3, "dan": 2, "cat": 1},
        }
    )
    assert reconcile("tus", 5, 2) == 2
    assert board(aws)["a"] == {"pts": 5 + 1 + 1 + 4, "events": 2, "banishHits": 1}
    assert board(aws, "all")["a"]["pts"] == 11


def test_winners(aws):
    s = aws.Table(SCORES_TABLE)
    s.put_item(
        Item={
            "pk": "WIN#tus#5",
            "sk": "USER#a",
            "picks": [{"player": "cat", "faction": "Traitor"}],
            "released": 0,
        }
    )
    s.put_item(
        Item={
            "pk": "WIN#tus#5",
            "sk": "USER#b",
            "picks": [{"player": "cat", "faction": "Faithful"}],
            "released": 6,
        }
    )
    assert reconcile_winners("tus", 5, {"cat": "Traitor"}, 12) == 2
    assert reconcile_winners("tus", 5, {"cat": "Traitor"}, 12) == 0
    assert board(aws) == {"a": {"pts": 30}, "b": {"pts": 10}}
