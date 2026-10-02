import pytest

from lambdas.common.points import ranks, round_table, score, winner

# US season 4, episode 9: Stephen 5, Johnny 2, Tara 2.
RT = {"banished": "stephen", "firstVote": {"stephen": 5, "johnny": 2, "tara": 2}}


def test_shared_ranks():
    assert ranks(RT["firstVote"]) == {"stephen": (1, 1), "johnny": (2, 3), "tara": (2, 3)}


@pytest.mark.parametrize(
    "picks,points",
    [
        (["stephen", "johnny", "tara"], 5 + 3 + 2),
        (["stephen", "tara", "johnny"], 10),  # tied twos: either order is exact
        (["johnny", "stephen", "tara"], 1 + 1 + 2),
        (["eric", "rob", "mark"], 0),
        (["stephen", "eric", "johnny"], 5 + 0 + 2),
    ],
)
def test_round_table(picks, points):
    assert round_table(picks, RT) == points


def test_fate_banishes_someone_who_wasnt_top():
    # UK series 4, episode 5: Amanda and Reece tied 5-5, then Fate took Amanda.
    result = {"banished": "amanda", "firstVote": {"amanda": 5, "reece": 5, "stephen": 3, "x": 1}}
    assert round_table(["amanda", "reece", "stephen"], result) == 5 + 3 + 2
    assert round_table(["reece", "amanda", "stephen"], result) == 1 + 3 + 2


def test_nights():
    assert score("MURDER", ["dan"], {"victims": ["dan", "eve"]}) == 4
    assert score("MURDER", ["dan"], {"victims": []}) == 0
    assert score("RECRUIT", ["katie"], {"recruits": ["katie"]}) == 4
    assert score("RECRUIT", ["katie"], {}) == 0


def test_winner():
    winners = {"rachel": "Traitor", "stephen": "Traitor"}
    bet = [{"player": "rachel", "faction": "Traitor"}, {"player": "jack", "faction": "Faithful"}]
    assert winner(bet, winners, 12, 0) == 30
    assert winner([{"player": "stephen", "faction": "Faithful"}], winners, 12, 0) == 20
    assert winner(bet, winners, 12, 6) == 15
    assert winner(bet, winners, 12, 11) == round(30 / 12)


def test_winner_bet_of_three():
    # UK series 4 had joint winners; each correct pick scores on its own.
    winners = {"rachel": "Traitor", "stephen": "Traitor"}
    bet = [
        {"player": "rachel", "faction": "Traitor"},
        {"player": "stephen", "faction": "Faithful"},
        {"player": "jack", "faction": "Faithful"},
    ]
    assert winner(bet, winners, 12, 0) == 30 + 20
    assert winner(bet, winners, 12, 6) == 25
