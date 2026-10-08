from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from lambdas.common import groups_dynamo, window
from lambdas.common.episodes_dynamo import catalog, performances
from lambdas.common.gate import rateable
from lambdas.cron_email.handler import handler
from scripts.seed_season import items, write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, SCORES_TABLE
from tests.social import A, B, C, sign_in
from tests.test_gate import SEASON

pytestmark = pytest.mark.scoring_window

# Episode 5, all of week 4, aired 2026-10-06 at 8pm EDT.
EP5_AIRS = datetime(2026, 10, 7, 0, tzinfo=UTC)
CELEBRITIES = [m["name"] for c in SEASON["contestants"] for m in c["members"]]


@pytest.fixture
def at(monkeypatch):
    clock = {"now": EP5_AIRS + timedelta(hours=15)}
    monkeypatch.setattr(window, "now", lambda: clock["now"])
    return lambda t: clock.__setitem__("now", t)


def counted(db, sub, ep, keys, err):
    """A score row for each dance, and the board's ERR row the poller would write."""
    for k in keys:
        db.Table(SCORES_TABLE).put_item(
            Item={"pk": f"EP#dwts#35#{ep:02d}", "sk": f"PERF#{k}#USER#{sub}", "value": Decimal(7)}
        )
        db.Table(BOARD_TABLE).put_item(
            Item={"pk": f"ERR#dwts#35#{ep:02d}", "sk": f"{k}#USER#{sub}", "err": Decimal(str(err))}
        )


def keys(ep):
    _, episode, contestants = catalog("dwts", 35, ep)
    return rateable(ep, episode, contestants, performances(f"EP#dwts#35#{ep:02d}"))


@pytest.fixture
def season(aws, at, outbox):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    for sub, name in ((A, "Ada"), (B, "Bea"), (C, "Cy")):
        sign_in(sub, name)
    # Weeks 1-3 are closed. Ada and Cy finish week 4; Bea scores one dance of it.
    for sub, err in ((A, 1.0), (B, 0.5), (C, 2.0)):
        counted(aws, sub, 4, keys(4), err)
    counted(aws, A, 5, keys(5), 0.25)
    counted(aws, C, 5, keys(5), 3.0)
    counted(aws, B, 5, keys(5)[:1], 0.0)
    group = groups_dynamo.create(A, "Bandits")
    groups_dynamo.join(B, group["inviteCode"])
    return aws


def mail_for(outbox, sub):
    (mail,) = [m for m in outbox if m["sub"] == sub and m["kind"] == "digest"]
    return mail["email"]


def test_due_the_morning_after_and_not_after_it_goes_stale(season, at, outbox):
    at(EP5_AIRS + timedelta(hours=10))
    handler({}, None)
    assert [m for m in outbox if m["kind"] == "digest" and "Week 4" in m["email"].subject] == []
    at(EP5_AIRS + timedelta(days=4))
    handler({}, None)
    assert [m for m in outbox if "Week 4" in m["email"].subject] == []


def test_revealed_reader_gets_the_week(season, outbox):
    out = handler({}, None)
    assert out["dwts.digest dwts-35#03"] == {"sent": 3}
    email = mail_for(outbox, A)
    assert email.subject == "Your Week 4 DWTS results are in"
    assert "This week" in email.text and "0.25 off" in email.text
    # Bea's 0.50 week still leads the season; Ada holds 2nd in the group and overall.
    assert "2. Ada (you)" in email.text and "Rank: #2 of 3" in email.text
    assert "Top of Week 4" in email.text


def test_unrevealed_reader_sees_only_through_their_last_finished_week(season, outbox):
    handler({}, None)
    email = mail_for(outbox, B)
    assert email.subject == "Your Week 4 DWTS results are in"
    assert email.preheader == "Finish Week 4 in the app to see how you did."
    assert "Standings below run through Week 3" in email.text
    # Week 4's numbers, Ada's 0.25 among them, are nowhere in Bea's email.
    assert "0.25" not in email.html and "Top of Week 4" not in email.text
    # Through week 3 Bea led on 0.50.
    assert "1. Bea (you)  0.50 off" in email.text
    assert "season=dwts-35&ep=05" in email.text


def test_no_email_names_a_contestant(season, outbox):
    handler({}, None)
    assert outbox
    for mail in outbox:
        for name in CELEBRITIES:
            assert name not in mail["email"].html and name not in mail["email"].subject


def test_one_digest_per_week(season, outbox):
    handler({}, None)
    assert handler({}, None)["dwts.digest dwts-35#03"] == {"dup": 3}


TPK = "SEASON#tus#5"


@pytest.fixture
def traitors(aws, at, outbox):
    t = aws.Table(CATALOG_TABLE)
    t.put_item(Item={"pk": TPK, "sk": "META", "current": True, "openAt": "2026-10-01T00:00:00Z"})
    t.put_item(Item={"pk": "SEASONS#tus", "sk": "SEASON#005", "id": "tus-5", "number": 5, "current": True})
    # Episode 1 released before the season opened in the app, so it's closed for everyone.
    for n, release in ((1, "2026-09-24T01:00:00Z"), (2, "2026-10-08T01:00:00Z"), (3, "2026-10-08T02:00:00Z")):
        t.put_item(Item={"pk": TPK, "sk": f"EP#{n:02d}", "releaseAt": release, "noRoundTable": n == 1})
    at(datetime(2026, 10, 8, 16, tzinfo=UTC))
    for sub, name in ((A, "Ada"), (B, "Bea")):
        sign_in(sub, name)
    scores, board = aws.Table(SCORES_TABLE), aws.Table(BOARD_TABLE)
    for n in (1, 2, 3):
        events = ("MURDER", "RECRUIT") if n == 1 else ("MURDER", "RT", "RECRUIT")
        for e in events:
            scores.put_item(Item={"pk": f"EP#tus#5#{n:02d}", "sk": f"EVT#{e}#USER#{A}", "picks": ["x"]})
            board.put_item(Item={"pk": f"PTS#tus#5#{n:02d}", "sk": f"{e}#USER#{A}", "pts": Decimal(4 if n > 1 else 1), "hit": False})
    # Bea picked episode 1 only.
    scores.put_item(Item={"pk": "EP#tus#5#01", "sk": f"EVT#MURDER#USER#{B}", "picks": ["x"]})
    board.put_item(Item={"pk": "PTS#tus#5#01", "sk": f"MURDER#USER#{B}", "pts": Decimal(4), "hit": False})
    return aws


def test_traitors_digest_by_release_night(traitors, outbox):
    out = handler({}, None)
    assert out == {"traitors.digest tus-5#01": {"sent": 2}}
    ada, bea = mail_for(outbox, A), mail_for(outbox, B)
    assert ada.subject == bea.subject == "The Traitors: your Episodes 2-3 results are in"
    assert "+24 pts" in ada.text and "Season: 26 pts" in ada.text
    assert "Standings below run through Episode 1" in bea.text
    assert "24" not in bea.text and "26" not in bea.text
    assert "1. Bea (you)  4 pts" in bea.text
