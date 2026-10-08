from datetime import UTC, datetime

import pytest
from botocore.exceptions import ClientError

from lambdas.common import email_dynamo, mailer
from scripts.email_samples import SAMPLES

NOW = datetime(2026, 10, 8, 12, tzinfo=UTC)
USER = {"sub": "s1", "email": "Fan@Example.com"}
CTX = SAMPLES["dwts-tonight"][2]


@pytest.fixture
def ses(aws, unsubscribe_secret, monkeypatch):
    monkeypatch.setenv("EMAIL_DOMAIN", "armchairjudge.com")
    monkeypatch.setenv("EMAIL_CONFIG_SET", "armchair-mail")
    monkeypatch.setattr(mailer, "production", lambda: True)
    monkeypatch.setattr(mailer, "_admins", lambda: frozenset({"admin@example.com"}))
    sent = []

    class Ses:
        fail = False

        def send_email(self, **kw):
            if Ses.fail:
                raise ClientError({"Error": {"Code": "Throttling"}}, "SendEmail")
            sent.append(kw)

    monkeypatch.setattr(mailer, "_ses", lambda: Ses())
    return sent, Ses


def deliver(user=USER, event="dwts-35#04", suppressed=frozenset()):
    return mailer.deliver(user, "dwts", "tonight", event, CTX, NOW, set(suppressed))


def test_sends_once_per_event(ses):
    sent, _ = ses
    assert deliver() == "sent"
    assert deliver() == "dup"
    assert deliver(event="dwts-35#05") == "sent"
    assert len(sent) == 2
    assert email_dynamo.sent("dwts.tonight", "dwts-35#04")[0]["sk"] == "USER#s1"


def test_a_failed_send_is_released_for_the_next_run(ses):
    sent, Ses = ses
    Ses.fail = True
    assert deliver() == "failed"
    assert email_dynamo.sent("dwts.tonight", "dwts-35#04")[0]["status"] == "failed"
    Ses.fail = False
    assert deliver() == "sent" and len(sent) == 1


def test_turned_off_missing_or_suppressed_never_sends(ses):
    sent, _ = ses
    assert deliver({**USER, "emailPrefs": {"dwts.tonight": False}}) == "off"
    assert deliver({**USER, "emailPrefs": {"dwts": False, "dwts.digest": False}}) == "sent"
    assert deliver({"sub": "s2"}, event="e2") == "noaddress"
    assert deliver(event="e3", suppressed={"fan@example.com"}) == "suppressed"
    assert len(sent) == 1


def test_sandbox_sends_to_admins_only_and_claims_nothing_else(ses, monkeypatch):
    sent, _ = ses
    monkeypatch.setattr(mailer, "production", lambda: False)
    assert deliver() == "held"
    assert email_dynamo.sent("dwts.tonight", "dwts-35#04") == []
    assert deliver({"sub": "a", "email": "Admin@example.com"}) == "sent"
    assert len(sent) == 1


def test_run_counts_add_up(aws):
    email_dynamo.record_run("dwts.tonight", "e", {"sent": 2, "held": 1}, NOW)
    email_dynamo.record_run("dwts.tonight", "e", {"sent": 1}, NOW)
    (row,) = email_dynamo.runs("dwts.tonight")
    assert (row["sent"], row["held"], row["lastAt"]) == (3, 1, "2026-10-08T12:00:00+00:00")
