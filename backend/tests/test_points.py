import pytest

from lambdas.common.points import calls, ranks, score, winner

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
    assert score("RT", picks, RT) == points


def test_fate_banishes_someone_who_wasnt_top():
    # UK series 4, episode 5: Amanda and Reece tied 5-5, then Fate took Amanda.
    result = {"banished": "amanda", "firstVote": {"amanda": 5, "reece": 5, "stephen": 3, "x": 1}}
    assert score("RT", ["amanda", "reece", "stephen"], result) == 5 + 3 + 2
    assert score("RT", ["reece", "amanda", "stephen"], result) == 1 + 3 + 2


def test_nights():
    assert score("MURDER", ["dan"], {"victims": ["dan", "eve"]}) == 4
    assert score("MURDER", ["dan"], {"victims": []}) == 0
    assert score("RECRUIT", ["katie"], {"recruits": ["katie"]}) == 4
    assert score("RECRUIT", ["katie"], {}) == 0


def slot(player, faction, released=0):
    return {"player": player, "faction": faction, "released": released}


def test_winner_ranked_shares():
    winners = {"rachel": "Traitor"}
    # 1st: 20 + 10. 2nd: 60% of that. 3rd: 30%.
    assert winner([slot("rachel", "Traitor")], winners, 12) == 30
    assert winner([slot("jack", "Faithful"), slot("rachel", "Traitor")], winners, 12) == 18
    assert (
        winner(
            [slot("a", "Faithful"), slot("b", "Faithful"), slot("rachel", "Traitor")], winners, 12
        )
        == 9
    )
    # The winner on the wrong side earns only the winner share.
    assert winner([slot("rachel", "Faithful")], winners, 12) == 20
    assert winner([slot("jack", "Faithful")], winners, 12) == 0


def test_winner_multiplier_per_slot():
    winners = {"rachel": "Traitor", "stephen": "Traitor"}
    assert winner([slot("rachel", "Traitor", 6)], winners, 12) == 15
    # 2.5 rounds half up, as Math.round does in the app.
    assert winner([slot("rachel", "Traitor", 11)], winners, 12) == 3
    assert winner([slot("jack", "Faithful"), slot("rachel", "Traitor", 3)], winners, 12) == 14
    # A 2nd place filled after six episodes: 18 * 6/12.
    bet = [slot("jack", "Faithful", 0), slot("stephen", "Traitor", 6)]
    assert winner(bet, winners, 12) == 9


def test_winner_joint_winners_score_each_slot():
    # UK series 1 had three joint winners; each named one scores at its own rank.
    winners = {"aaron": "Faithful", "hannah": "Faithful", "meryl": "Faithful"}
    bet = [slot("hannah", "Faithful"), slot("aaron", "Traitor"), slot("meryl", "Faithful")]
    assert winner(bet, winners, 12) == 30 + 12 + 9


def test_calls_say_why_each_pick_scored():
    assert calls("RT", ["stephen", "tara", "rob"], RT) == [
        {"player": "stephen", "points": 5, "why": "banished"},
        {"player": "tara", "points": 3, "why": "exact"},
        {"player": "rob", "points": 0, "why": "miss"},
    ]
    assert calls("RT", ["johnny", "stephen", "tara"], RT) == [
        {"player": "johnny", "points": 1, "why": "top3"},
        {"player": "stephen", "points": 1, "why": "top3"},
        {"player": "tara", "points": 2, "why": "exact"},
    ]
    assert calls("MURDER", ["dan"], {"victims": ["dan"]}) == [
        {"player": "dan", "points": 4, "why": "hit"}
    ]
    assert calls("MURDER", ["dan"], {"victims": ["eve"]}) == [
        {"player": "dan", "points": 0, "why": "miss"}
    ]
    assert calls("RECRUIT", ["katie"], {"recruits": []}) == [
        {"player": "katie", "points": 0, "why": "void"}
    ]
