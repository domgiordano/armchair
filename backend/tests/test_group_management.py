import pytest

from lambdas.groups_delete.handler import handler as delete_handler
from lambdas.groups_invite.handler import handler as invite_handler
from lambdas.groups_leave.handler import handler as leave_handler
from lambdas.groups_manage.handler import handler as manage_handler
from lambdas.groups_respond.handler import handler as respond_handler
from tests.conftest import GROUPS_TABLE
from tests.social import A, B, C, accept, ask, post
from tests.test_groups import create, join, mine
from tests.test_notifications import notes


@pytest.fixture
def family(people) -> dict:
    """A owns Family; A and B are friends; C knows nobody."""
    ask(A, B)
    accept(B, A)
    return create()[1]["data"]


def invite(gid, to, by=A) -> tuple[int, dict]:
    return post(invite_handler, "/groups/invite", by, {"group": gid, "sub": to})


def respond(gid, sub, yes) -> tuple[int, dict]:
    return post(respond_handler, "/groups/respond", sub, {"group": gid, "accept": yes})


def manage(gid, action, by=A, **extra) -> tuple[int, dict]:
    return post(manage_handler, "/groups/manage", by, {"group": gid, "action": action, **extra})


def leave(gid, sub) -> tuple[int, dict]:
    return post(leave_handler, "/groups/leave", sub, {"group": gid})


def delete(gid, by=A) -> tuple[int, dict]:
    return post(delete_handler, "/groups/delete", by, {"group": gid})


def member_subs(sub=A) -> list[str]:
    return [m["sub"] for m in mine(sub)[0]["members"]]


def group_notes(sub) -> list[dict]:
    return [n for n in notes(sub)[0] if n["type"].startswith("group_")]


def test_mine_gives_each_person_the_callers_relation(family):
    join(family["inviteCode"], sub=B)
    join(family["inviteCode"], sub=C)
    ask(A, C)

    def relations(sub):
        return {m["sub"]: m["relation"] for m in mine(sub)[0]["members"]}

    assert relations(A) == {A: None, B: "friend", C: "outgoing"}
    assert relations(C) == {A: "incoming", B: None, C: None}


def test_invite_notifies_the_friend_once_and_accepting_joins(family):
    gid = family["id"]
    assert invite(gid, B)[1]["data"] == {"status": "invited"}
    assert invite(gid, B)[1]["data"] == {"status": "invited"}
    (note,) = group_notes(B)
    assert note["type"] == "group_invite"
    assert note["state"] == "pending"
    assert note["from"]["sub"] == A
    assert note["group"] == {"id": gid, "name": "Family"}
    assert [m["sub"] for m in mine()[0]["invited"]] == [B]

    status, body = respond(gid, B, True)
    assert status == 200, body
    assert body["data"] == {"id": gid, "name": "Family", "member": True}
    assert sorted(member_subs()) == sorted([A, B])
    assert mine()[0]["invited"] == []
    assert group_notes(B)[0]["state"] == "accepted"
    assert respond(gid, B, True)[0] == 404
    assert invite(gid, B)[1]["data"] == {"status": "member"}


def test_declining_an_invite_keeps_them_out(family):
    invite(family["id"], B)
    assert respond(family["id"], B, False)[1]["data"]["member"] is False
    assert member_subs() == [A]
    assert mine(B) == []
    assert group_notes(B)[0]["state"] == "declined"


def test_only_friends_can_be_invited(family):
    assert invite(family["id"], C)[0] == 403
    assert group_notes(C) == []


def test_only_members_can_invite(family):
    # B is A's friend but not in Family.
    assert invite(family["id"], A, by=B)[0] == 403


@pytest.mark.parametrize(
    "gid, expected", [("A" * 12, 404), ("short", 400), (None, 400), ("../GROUP#x", 400)]
)
def test_invite_to_a_bad_group(family, gid, expected):
    assert invite(gid, B)[0] == expected


def test_respond_needs_a_boolean_and_an_invite(family):
    assert respond(family["id"], B, "yes")[0] == 400
    assert respond(family["id"], B, True)[0] == 404


@pytest.mark.parametrize(
    "action, extra",
    [
        ("rename", {"name": "Mine now"}),
        ("remove", {"sub": A}),
        ("approval", {"approval": True}),
        ("approve", {"sub": C}),
        ("deny", {"sub": C}),
    ],
)
def test_manage_is_owner_only(family, action, extra):
    join(family["inviteCode"], sub=B)
    status, body = manage(family["id"], action, by=B, **extra)
    assert status == 403, body
    assert mine()[0]["name"] == "Family"
    assert sorted(member_subs()) == sorted([A, B])


def test_delete_is_owner_only(family):
    join(family["inviteCode"], sub=B)
    assert delete(family["id"], by=B)[0] == 403
    assert mine(B)[0]["id"] == family["id"]


def test_rename(family):
    assert manage(family["id"], "rename", name="  The Fam ")[0] == 200
    assert mine()[0]["name"] == "The Fam"


@pytest.mark.parametrize("name", [None, "", "x" * 41])
def test_rename_rejects_a_bad_name(family, name):
    assert manage(family["id"], "rename", name=name)[0] == 400


def test_unknown_action_is_400(family):
    assert manage(family["id"], "promote", sub=B)[0] == 400


def test_owner_removes_a_member_but_not_themselves(family):
    join(family["inviteCode"], sub=B)
    assert manage(family["id"], "remove", sub=B)[0] == 200
    assert member_subs() == [A]
    assert mine(B) == []
    assert manage(family["id"], "remove", sub=A)[0] == 400


def test_approval_turns_the_link_into_a_request(family):
    gid = family["id"]
    assert manage(gid, "approval", approval=True)[0] == 200
    assert mine()[0]["approval"] is True

    status, body = join(family["inviteCode"], sub=C)
    assert status == 200
    assert body["data"] == {"id": gid, "name": "Family", "pending": True}
    join(family["inviteCode"], sub=C)
    assert mine(C) == []
    (note,) = group_notes(A)
    assert note["type"] == "group_join_request" and note["from"]["sub"] == C
    assert [r["sub"] for r in mine()[0]["requests"]] == [C]

    assert manage(gid, "approve", sub=C)[0] == 200
    assert sorted(member_subs()) == sorted([A, C])
    assert group_notes(A)[0]["state"] == "accepted"
    (welcome,) = group_notes(C)
    assert welcome["type"] == "group_join_accepted"
    assert welcome["group"] == {"id": gid, "name": "Family"}
    # Only the owner sees requests.
    assert mine(C)[0]["requests"] == []
    assert manage(gid, "approve", sub=C)[0] == 404


def test_denying_a_join_request(family):
    manage(family["id"], "approval", approval=True)
    join(family["inviteCode"], sub=C)
    assert manage(family["id"], "deny", sub=C)[0] == 200
    assert member_subs() == [A]
    assert mine()[0]["requests"] == []
    assert group_notes(A)[0]["state"] == "declined"


def test_members_join_by_link_without_approval(family):
    assert join(family["inviteCode"], sub=C)[1]["data"]["pending"] is False
    manage(family["id"], "approval", approval=True)
    # Already in: the link still says so rather than filing a request.
    assert join(family["inviteCode"], sub=C)[1]["data"]["pending"] is False


def test_leave(family):
    gid = family["id"]
    join(family["inviteCode"], sub=B)
    assert leave(gid, B)[0] == 200
    assert mine(B) == []
    assert leave(gid, B)[0] == 404
    assert leave(gid, A)[0] == 409
    assert member_subs() == [A]


def test_delete_removes_every_row_and_withdraws_invites(family, aws):
    gid = family["id"]
    join(family["inviteCode"], sub=C)
    invite(gid, B)
    assert len(group_notes(B)) == 1

    assert delete(gid)[0] == 200
    assert aws.Table(GROUPS_TABLE).scan()["Items"] == []
    assert mine() == mine(C) == []
    assert group_notes(B) == []
    assert respond(gid, B, True)[0] == 404
    assert join(family["inviteCode"], sub=B)[0] == 404
