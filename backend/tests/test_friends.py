import json

import pytest

from lambdas.friends_accept.handler import handler as accept_handler
from lambdas.friends_block.handler import handler as block_handler
from lambdas.friends_list.handler import handler as list_handler
from lambdas.friends_remove.handler import handler as remove_handler
from lambdas.friends_request.handler import handler as request_handler
from lambdas.friends_search.handler import handler as search_handler
from lambdas.users_me.handler import handler as me_handler
from tests.conftest import SOCIAL_TABLE
from tests.events import PICTURE, SUB, authorized_event

A = SUB
B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"


def call(handler, event) -> tuple[int, dict]:
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def sign_in(sub, name, picture=PICTURE):
    event = authorized_event(sub=sub, name=name, picture=picture, email=f"{sub[-1]}@example.com")
    assert call(me_handler, event)[0] == 200


@pytest.fixture
def people(aws):
    sign_in(A, "Ada Lovelace")
    sign_in(B, "Bea Arthur", picture=None)
    sign_in(C, "Adam Driver")


def post(handler, path, sub, payload) -> tuple[int, dict]:
    return call(handler, authorized_event(path=path, method="POST", sub=sub, body=payload))


def ask(frm, to):
    return post(request_handler, "/friends/request", frm, {"sub": to})


def accept(frm, to):
    return post(accept_handler, "/friends/accept", frm, {"sub": to})


def remove(frm, to):
    return post(remove_handler, "/friends/remove", frm, {"sub": to})


def block(frm, to, blocked=True):
    return post(block_handler, "/friends/block", frm, {"sub": to, "blocked": blocked})


def listing(sub) -> dict:
    status, body = call(list_handler, authorized_event(path="/friends/list", sub=sub))
    assert status == 200, body
    return body["data"]


def subs(people_list) -> list[str]:
    return [p["sub"] for p in people_list]


def search(sub, q) -> tuple[int, dict]:
    return call(search_handler, authorized_event(path="/friends/search", sub=sub, query={"q": q}))


def found(sub, q) -> dict[str, str | None]:
    status, body = search(sub, q)
    assert status == 200, body
    return {r["sub"]: r["status"] for r in body["data"]}


def test_request_then_accept_makes_friends_both_ways(people):
    status, body = ask(A, B)
    assert status == 200, body
    assert body["data"] == {
        "status": "outgoing",
        "user": {"sub": B, "name": "Bea Arthur", "picture": None, "avatarKind": "initials"},
    }
    assert subs(listing(A)["outgoing"]) == [B]
    incoming = listing(B)["incoming"]
    assert subs(incoming) == [A]
    assert incoming[0]["name"] == "Ada Lovelace"

    assert accept(B, A)[1]["data"] == {"status": "friend"}
    for me, them in ((A, B), (B, A)):
        mine = listing(me)
        assert subs(mine["friends"]) == [them]
        assert mine["incoming"] == mine["outgoing"] == []
    assert "@example.com" not in json.dumps(listing(A))


def test_asking_twice_is_idempotent_and_asking_back_accepts(people):
    ask(A, B)
    assert ask(A, B)[1]["data"]["status"] == "outgoing"
    assert ask(B, A)[1]["data"]["status"] == "friend"
    assert subs(listing(A)["friends"]) == [B]
    assert ask(A, B)[1]["data"]["status"] == "friend"


def test_accept_without_a_request_is_404(people):
    assert accept(B, A)[0] == 404
    ask(A, B)
    # Only the one who was asked can accept.
    assert accept(A, B)[0] == 404


@pytest.mark.parametrize(
    "who, other", [("friend", None), ("cancel", A), ("decline", B)], ids=lambda x: str(x)
)
def test_remove_covers_unfriend_cancel_and_decline(people, who, other):
    ask(A, B)
    if who == "friend":
        accept(B, A)
    remover = other or A
    assert remove(remover, B if remover == A else A)[1]["data"] == {"status": None}
    for me in (A, B):
        mine = listing(me)
        assert mine["friends"] == mine["incoming"] == mine["outgoing"] == []
    # Nothing left over, so either can ask again.
    assert ask(B, A)[1]["data"]["status"] == "outgoing"


def test_remove_with_no_relationship_is_a_quiet_200(people):
    assert remove(A, B)[0] == 200


@pytest.mark.parametrize("payload", [{}, {"sub": "nope"}, {"sub": A}, {"sub": 7}])
def test_request_rejects_a_bad_target(people, payload):
    assert post(request_handler, "/friends/request", A, payload)[0] == 400


def test_request_to_someone_who_never_signed_in_is_404(people):
    assert ask(A, "3f1c2b9a-0000-4000-8000-000000000009")[0] == 404
    assert listing(A)["outgoing"] == []


def test_invite_code_is_stable_and_sends_a_request(people, aws):
    code = listing(B)["inviteCode"]
    assert len(code) == 16
    assert listing(B)["inviteCode"] == code

    status, body = post(request_handler, "/friends/request", A, {"code": code})
    assert status == 200, body
    assert body["data"]["status"] == "outgoing"
    assert body["data"]["user"]["sub"] == B
    assert subs(listing(B)["incoming"]) == [A]


@pytest.mark.parametrize(
    "code, expected", [("A" * 16, 404), ("short", 400), ("../../etc/passwd", 400), (7, 400)]
)
def test_bad_invite_code(people, code, expected):
    assert post(request_handler, "/friends/request", A, {"code": code})[0] == expected


def test_own_invite_code_is_400(people):
    code = listing(A)["inviteCode"]
    assert post(request_handler, "/friends/request", A, {"code": code})[0] == 400


def test_block_ends_the_friendship_and_hides_both_ways(people):
    ask(A, B)
    accept(B, A)
    assert block(A, B)[1]["data"] == {"status": "blocked"}

    assert listing(A)["friends"] == [] and subs(listing(A)["blocked"]) == [B]
    # Being blocked is never shown to the one blocked.
    assert listing(B) | {"inviteCode": None} == {
        "inviteCode": None,
        "friends": [],
        "incoming": [],
        "outgoing": [],
        "blocked": [],
    }
    assert ask(B, A)[0] == 404
    assert ask(A, B)[0] == 404
    assert B not in found(A, "bea")
    assert A not in found(B, "ada")

    assert block(A, B, blocked=False)[1]["data"] == {"status": None}
    assert found(B, "ada l") == {A: None}
    assert ask(B, A)[1]["data"]["status"] == "outgoing"


def test_block_needs_a_boolean(people):
    assert post(block_handler, "/friends/block", A, {"sub": B, "blocked": "yes"})[0] == 400


def test_search_is_a_case_insensitive_prefix_that_skips_the_caller(people):
    assert found(B, "  AD ") == {A: None, C: None}
    assert found(B, "ada l") == {A: None}
    assert found(A, "ad") == {C: None}
    assert found(A, "lovelace") == {}

    ask(A, C)
    assert found(A, "adam") == {C: "outgoing"}
    assert found(C, "ada") == {A: "incoming"}

    _, body = search(B, "ada")
    assert body["data"][0] == {
        "sub": A,
        "name": "Ada Lovelace",
        "picture": PICTURE,
        "avatarKind": "google",
        "status": None,
    }
    assert "@" not in json.dumps(body)


@pytest.mark.parametrize("q", [None, "", "a", "  a  ", "x" * 41])
def test_search_needs_two_to_forty_characters(people, q):
    assert search(A, q)[0] == 400


def test_search_follows_a_rename_and_a_dropped_name(people, aws):
    sign_in(C, "Carol Burnett")
    assert found(A, "adam") == {}
    assert found(A, "car") == {C: None}

    sign_in(C, None)
    assert found(A, "car") == {}
    rows = aws.Table(SOCIAL_TABLE).scan()["Items"]
    assert not [r for r in rows if r.get("sub") == C or r["pk"] == f"USER#{C}"]


def test_signing_in_again_unchanged_writes_nothing(people, aws, monkeypatch):
    import lambdas.common.social_dynamo as social

    calls = []
    monkeypatch.setattr(social, "_transact", lambda items: calls.append(items) or True)
    sign_in(A, "Ada Lovelace")
    assert calls == []
    sign_in(A, "Ada Lovelace", picture=None)
    assert len(calls) == 1


def test_missing_sub_is_401(people):
    event = authorized_event(path="/friends/list")
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert call(list_handler, event)[0] == 401
