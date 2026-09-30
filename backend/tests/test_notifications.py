import json
import time

import pytest

from lambdas.notifications_list.handler import handler as list_handler
from lambdas.notifications_read.handler import handler as read_handler
from tests.conftest import SOCIAL_TABLE
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask, block, call, remove


def notes(sub, **params) -> tuple[list[dict], dict]:
    query = {k: str(v) for k, v in params.items()} or None
    status, body = call(
        list_handler, authorized_event(path="/notifications/list", sub=sub, query=query)
    )
    assert status == 200, body
    return body["data"], body["meta"]


def read(sub, payload) -> tuple[int, dict]:
    event = authorized_event(path="/notifications/read", method="POST", sub=sub, body=payload)
    return call(read_handler, event)


def test_a_request_notifies_and_accepting_resolves_it_and_notifies_back(people):
    ask(A, B)
    items, meta = notes(B)
    assert meta == {"unread": 1, "next": None}
    (note,) = items
    assert note["type"] == "friend_request"
    assert note["state"] == "pending" and note["read"] is False
    assert note["from"] == {
        "sub": A,
        "name": "Ada Lovelace",
        "picture": note["from"]["picture"],
        "avatarKind": "google",
    }
    assert note["group"] is None
    assert "@" not in json.dumps(items)

    accept(B, A)
    (note,) = notes(B)[0]
    assert note["state"] == "accepted" and note["read"] is True
    (back,) = notes(A)[0]
    assert back["type"] == "friend_accepted"
    assert back["from"]["sub"] == B
    assert back["state"] is None


def test_asking_back_resolves_the_first_request(people):
    ask(A, B)
    ask(B, A)
    (note,) = notes(B)[0]
    assert note["state"] == "accepted"
    assert [n["type"] for n in notes(A)[0]] == ["friend_accepted"]


def test_declining_marks_it_and_cancelling_withdraws_it(people):
    ask(A, B)
    remove(B, A)
    (note,) = notes(B)[0]
    assert note["state"] == "declined" and note["read"] is True
    assert notes(A)[0] == []

    ask(A, C)
    assert len(notes(C)[0]) == 1
    remove(A, C)
    assert notes(C)[0] == []


def test_blocking_a_requester_declines_their_request(people):
    ask(A, B)
    block(B, A)
    (note,) = notes(B)[0]
    assert note["state"] == "declined"


def test_asking_twice_notifies_once(people):
    ask(A, B)
    ask(A, B)
    assert len(notes(B)[0]) == 1


def test_unread_first_then_newest_and_paged(people, aws):
    tbl = aws.Table(SOCIAL_TABLE)
    later = int(time.time()) + 3600
    for i, is_read in enumerate([True, False, True, False, False]):
        tbl.put_item(
            Item={
                "pk": f"NOTIF#{A}",
                "sk": f"2026-09-0{i + 1}T00:00:00+00:00#abcdefg{i}",
                "type": "friend_accepted",
                "from": B,
                "read": is_read,
                "expiresAt": later,
            }
        )
    # Past its TTL but not yet swept by DynamoDB.
    tbl.put_item(
        Item={
            "pk": f"NOTIF#{A}",
            "sk": "2026-09-09T00:00:00+00:00#expiredx",
            "type": "friend_accepted",
            "from": B,
            "read": False,
            "expiresAt": int(time.time()) - 1,
        }
    )

    first, meta = notes(A, limit=3)
    assert meta == {"unread": 3, "next": "3"}
    assert [n["at"][:10] for n in first] == ["2026-09-05", "2026-09-04", "2026-09-02"]
    rest, meta = notes(A, limit=3, cursor=3)
    assert meta["next"] is None
    assert [(n["at"][:10], n["read"]) for n in rest] == [("2026-09-03", True), ("2026-09-01", True)]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 51}, {"cursor": -1}, {"limit": "x"}])
def test_list_rejects_bad_paging(people, params):
    query = {k: str(v) for k, v in params.items()}
    event = authorized_event(path="/notifications/list", sub=A, query=query)
    assert call(list_handler, event)[0] == 400


def test_read_one_then_all(people):
    ask(A, B)
    ask(C, B)
    items, meta = notes(B)
    assert meta["unread"] == 2

    status, body = read(B, {"id": items[0]["id"]})
    assert status == 200, body
    assert notes(B)[1]["unread"] == 1

    assert read(B, {"all": True})[1]["data"] == {"unread": 0}
    items, meta = notes(B)
    assert meta["unread"] == 0
    # Read is not answered: the buttons stay until they act.
    assert {n["state"] for n in items} == {"pending"}


def test_read_someone_elses_notification_is_404(people):
    ask(A, B)
    nid = notes(B)[0][0]["id"]
    assert read(C, {"id": nid})[0] == 404
    assert notes(B)[1]["unread"] == 1


@pytest.mark.parametrize("payload", [{}, {"id": "nope"}, {"all": "true"}, {"id": 5}])
def test_read_rejects_a_bad_body(people, payload):
    assert read(A, payload)[0] == 400


def test_new_notifications_expire(people, aws):
    ask(A, B)
    (row,) = aws.Table(SOCIAL_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": f"NOTIF#{B}"}
    )["Items"]
    assert 89 * 86400 < int(row["expiresAt"]) - time.time() <= 90 * 86400
