from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from lambdas.common import window
from lambdas.common.episodes_dynamo import catalog, performances
from lambdas.common.gate import rateable
from lambdas.common.users_dynamo import set_email_settings
from lambdas.cron_email.handler import handler
from scripts.seed_season import items, write
from tests.conftest import CATALOG_TABLE, SCORES_TABLE
from tests.social import A, B, C, sign_in
from tests.test_gate import SEASON

pytestmark = pytest.mark.scoring_window

# Episode 6 airs 2026-10-13 at 8pm EDT, which closes episode 5.
EP6_AIRS = datetime(2026, 10, 14, 0, tzinfo=UTC)


@pytest.fixture
def at(monkeypatch):
    clock = {"now": EP6_AIRS}
    monkeypatch.setattr(window, "now", lambda: clock["now"])
    return lambda t: clock.__setitem__("now", t)


@pytest.fixture
def show(aws, at, outbox):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    for sub, name in ((A, "Ada"), (B, "Bea"), (C, "Cy")):
        sign_in(sub, name)
    _, episode, contestants = catalog("dwts", 35, 5)
    keys = rateable(5, episode, contestants, performances("EP#dwts#35#05"))
    scores = aws.Table(SCORES_TABLE)
    # Bea has scored every dance of episode 5, Ada two of them; Cy has never played.
    for sub, ks in ((B, keys), (A, keys[:2])):
        for k in ks:
            scores.put_item(
                Item={"pk": "EP#dwts#35#05", "sk": f"PERF#{k}#USER#{sub}", "value": Decimal(7)}
            )
    return keys


def kinds(outbox, kind="tonight"):
    return sorted((m["kind"], m["sub"]) for m in outbox if m["kind"] == kind)


def test_tonight_goes_two_hours_ahead_to_players_once(show, at, outbox):
    at(EP6_AIRS - timedelta(hours=3))
    handler({}, None)
    assert kinds(outbox) == []

    at(EP6_AIRS - timedelta(minutes=110))
    out = handler({}, None)
    assert kinds(outbox) == [("tonight", A), ("tonight", B)]
    assert out["dwts.tonight dwts-35#06"] == {"sent": 2}
    email = next(m["email"] for m in outbox if m["kind"] == "tonight")
    assert email.subject == "Tonight: DWTS Week 5"
    assert "8:00 pm ET" in email.text and "season=dwts-35&ep=06" in email.text

    at(EP6_AIRS - timedelta(minutes=95))
    assert handler({}, None)["dwts.tonight dwts-35#06"] == {"dup": 2}
    assert len(kinds(outbox)) == 2


def test_closing_reminds_only_the_unfinished(show, at, outbox):
    at(EP6_AIRS - timedelta(days=3))
    handler({}, None)
    assert outbox == []

    at(EP6_AIRS - timedelta(days=1, hours=20))
    handler({}, None)
    assert kinds(outbox, "closing") == [("closing", A)]
    email = outbox[0]["email"]
    assert email.subject == "Don't forget: Week 4 locks in 2 days"
    assert f"You've scored 2 of {len(show)} dances" in email.text


def test_a_type_turned_off_is_skipped(show, at, outbox):
    set_email_settings(A, {"dwts.tonight": False}, None)
    at(EP6_AIRS - timedelta(hours=1))
    assert handler({}, None)["dwts.tonight dwts-35#06"] == {"off": 1, "sent": 1}
    assert kinds(outbox) == [("tonight", B)]


def test_traitors_night_with_two_episodes_is_one_email(aws, at, outbox):
    t = aws.Table(CATALOG_TABLE)
    pk = "SEASON#tus#5"
    t.put_item(Item={"pk": pk, "sk": "META", "current": True, "openAt": "2026-10-01T00:00:00Z"})
    t.put_item(
        Item={"pk": "SEASONS#tus", "sk": "SEASON#005", "id": "tus-5", "number": 5, "current": True}
    )
    for n, release in (
        (1, "2026-10-09T01:00:00Z"),
        (2, "2026-10-16T01:00:00Z"),
        (3, "2026-10-16T02:00:00Z"),
    ):
        t.put_item(Item={"pk": pk, "sk": f"EP#{n:02d}", "releaseAt": release})
    sign_in(A, "Ada")
    sign_in(B, "Bea")
    aws.Table(SCORES_TABLE).put_item(Item={"pk": "WIN#tus#5", "sk": f"USER#{A}", "picks": []})

    at(datetime(2026, 10, 15, 23, 30, tzinfo=UTC))
    out = handler({}, None)
    assert out == {"traitors.tonight tus-5#02": {"sent": 1}}
    (mail,) = outbox
    assert mail["sub"] == A and mail["show"] == "traitors"
    assert mail["email"].subject == "Tonight: The Traitors Episodes 2-3"
    assert "9:00 pm ET" in mail["email"].text
