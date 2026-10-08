from botocore.exceptions import ClientError

from lambdas.common import email_social, groups_dynamo, mailer
from lambdas.common.users_dynamo import set_email_settings
from lambdas.friends_request.handler import handler as request_handler
from lambdas.groups_invite.handler import handler as invite_handler
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask, call

TRAITORS = "https://traitors.armchairjudge.com"


def request_from(origin, frm, to):
    event = authorized_event(
        path="/friends/request", method="POST", sub=frm, body={"sub": to}, origin=origin
    )
    return call(request_handler, event)


def test_a_new_friend_request_emails_once(people, outbox):
    assert ask(A, B)[0] == 200
    assert ask(A, B)[0] == 200
    (mail,) = outbox
    assert (mail["to"], mail["kind"], mail["show"]) == ("2@example.com", "friend_request", "dwts")
    assert mail["email"].subject == "Ada Lovelace wants to be friends"
    assert "https://dwts.armchairjudge.com/social/" in mail["email"].text


def test_accepting_by_asking_back_sends_nothing_new(people, outbox):
    ask(A, B)
    ask(B, A)
    assert [m["to"] for m in outbox] == ["2@example.com"]


def test_a_request_from_traitors_wears_traitors_and_points_at_the_hub(people, outbox):
    assert request_from(TRAITORS, A, C)[0] == 200
    (mail,) = outbox
    assert mail["show"] == "traitors"
    assert "https://armchairjudge.com/social/" in mail["email"].text


def test_social_turned_off_is_skipped(people, outbox):
    set_email_settings(B, {"social": False}, None)
    ask(A, B)
    assert outbox == []


def test_a_group_invite_from_traitors(people, outbox):
    ask(A, B)
    accept(B, A)
    outbox.clear()
    gid = groups_dynamo.create(A, "Round Table")["id"]
    event = authorized_event(
        path="/groups/invite", method="POST", sub=A, body={"group": gid, "sub": B}, origin=TRAITORS
    )
    assert call(invite_handler, event)[0] == 200
    assert call(invite_handler, event)[0] == 200
    (mail,) = outbox
    assert (mail["kind"], mail["show"]) == ("group_invite", "traitors")
    assert mail["email"].subject == "Ada Lovelace invited you to Round Table"
    assert f"{TRAITORS}/groups/" in mail["email"].text


def test_a_mail_failure_never_fails_the_request(people, outbox, monkeypatch):
    def broken(*args):
        raise ClientError({"Error": {"Code": "ServiceUnavailable"}}, "SendEmail")

    monkeypatch.setattr(mailer, "deliver", broken)
    status, out = ask(A, B)
    assert status == 200 and out["data"]["status"] == "outgoing"


def test_group_activated_mails_the_other_members_once(people, outbox):
    group = groups_dynamo.create(A, "Round Table")
    groups_dynamo.join(B, group["inviteCode"])
    groups_dynamo.join(C, group["inviteCode"])
    set_email_settings(C, {"groups": False}, None)

    assert email_social.send_group_activated(group["id"], "traitors", A) == {"sent": 1, "off": 1}
    assert email_social.send_group_activated(group["id"], "traitors", A) == {"dup": 1, "off": 1}
    (mail,) = outbox
    assert (mail["sub"], mail["kind"], mail["show"]) == (B, "group_activated", "traitors")
    assert mail["email"].subject == "Ada Lovelace started The Traitors for Round Table"
    assert f"{TRAITORS}/groups/?group={group['id']}" in mail["email"].text
    assert "Join on The Traitors" in mail["email"].html

    # The same group starting DWTS is a new email.
    assert email_social.send_group_activated(group["id"], "dwts", B)["sent"] == 1
