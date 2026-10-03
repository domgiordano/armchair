from lambdas.common.traitors_recap import written

WHO = {"kim": "Kim Daily", "madeline": "Madeline Kostopulos", "katie": "Katie Fites"}


def test_episode_told_from_its_results():
    recap = written(
        {
            "MURDER": {"victims": ["kim"]},
            "RT": {
                "banished": "madeline",
                "faction": "Faithful",
                "firstVote": {"madeline": 13, "victor": 7, "kriste": 1},
            },
            "RECRUIT": {"recruits": ["katie"]},
        },
        WHO,
    )
    assert recap == {
        "text": "At breakfast, Kim Daily was found murdered. "
        "At the round table, Madeline Kostopulos was banished with 13 of 21 votes and revealed they were a Faithful. "
        "That night the Traitors went after a new recruit: Katie Fites.",
        "source": "results",
        "sourceUrl": None,
    }


def test_quiet_night_and_nothing_settled():
    assert (
        written({"MURDER": {"victims": []}}, WHO)["text"]
        == "Everyone made it to breakfast: no murder."
    )
    assert written({"MURDER": None, "RT": None}, WHO) is None
    assert written({"MURDER": {"victims": ["kim", "katie"]}}, WHO)["text"].startswith(
        "At breakfast, Kim Daily and Katie Fites were"
    )
