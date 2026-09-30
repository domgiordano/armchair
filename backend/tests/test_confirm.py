from decimal import Decimal

from lambdas.common import confirm


def test_a_judge_sitting_out_gets_no_entry():
    got = confirm.judges({}, ["a", "b", "c"], [Decimal(10), None, Decimal(9)], 100, 1, window=0)
    assert set(got) == {"a", "c"}
    assert got["a"] == {"value": 10, "state": "confirmed", "firstSeenAt": 100, "rev": 1}
