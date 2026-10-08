from datetime import UTC, datetime

from lambdas.admin_email_log.handler import handler as log_handler
from lambdas.admin_email_test.handler import handler as send_handler
from lambdas.common import email_dynamo
from lambdas.common.email_samples import SAMPLES
from tests.conftest import set_admins
from tests.events import authorized_event
from tests.social import A, B, call, sign_in

NOW = datetime(2026, 10, 8, 12, tzinfo=UTC)


def email_test(payload, email="boss@example.com"):
    return call(
        send_handler,
        authorized_event(path="/admin/email-test", method="POST", body=payload, email=email),
    )


def email_log(query=None, email="boss@example.com"):
    return call(log_handler, authorized_event(path="/admin/email-log", query=query, email=email))


def test_admins_only(admins, outbox):
    assert email_test({"template": "dwts-tonight"})[0] == 403
    assert email_log()[0] == 403


def test_preview_renders_without_sending(admins, outbox):
    set_admins("boss@example.com")
    status, out = email_test({"template": "traitors-digest"})
    data = out["data"]
    assert status == 200 and outbox == []
    assert data["subject"] == "The Traitors: your Episodes 4-5 results are in"
    assert data["from"].endswith("<traitors@armchairjudge.com>")
    assert "<html" in data["html"] and data["sent"] is False and data["to"] is None


def test_send_goes_to_the_caller_only_and_can_repeat(admins, outbox):
    set_admins("boss@example.com")
    for _ in range(2):
        status, out = email_test(
            {"template": "dwts-digest", "send": True}, email="Boss@Example.com"
        )
        assert status == 200 and out["data"]["to"] == "boss@example.com"
    assert [m["to"] for m in outbox] == ["boss@example.com"] * 2


def test_unknown_template_lists_them(admins, outbox):
    set_admins("boss@example.com")
    status, out = email_test({"template": "nope"})
    assert status == 400 and out["error"]["detail"]["templates"] == sorted(SAMPLES)
    assert email_test({"template": "dwts-tonight", "send": "yes"})[0] == 400


def test_log_lists_runs_and_one_runs_readers(admins):
    set_admins("boss@example.com")
    sign_in(A, "Ada")
    email_dynamo.record_run("dwts.tonight", "dwts-35#06", {"sent": 2, "off": 1}, NOW)
    email_dynamo.claim("dwts.tonight", "dwts-35#06", A, NOW)
    email_dynamo.claim("dwts.tonight", "dwts-35#06", B, NOW)

    status, out = email_log()
    (run,) = out["data"]["runs"]["dwts.tonight"]
    assert status == 200 and run["event"] == "dwts-35#06"
    assert (run["sent"], run["off"], run["failed"]) == (2, 1, 0)
    assert out["data"]["runs"]["traitors.digest"] == []
    assert "dwts-digest" in out["data"]["templates"]

    status, out = email_log({"type": "dwts.tonight", "event": "dwts-35#06"})
    readers = {r["sub"]: r for r in out["data"]["readers"]}
    assert readers[A]["name"] == "Ada" and readers[A]["status"] == "sent"
    assert readers[B]["name"] is None
    assert email_log({"type": "nope"})[0] == 400
