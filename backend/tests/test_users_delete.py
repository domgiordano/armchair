"""/users/delete against moto: everything naming the caller goes, everyone else's stays."""

import json

import boto3
import pytest
from botocore.stub import Stubber

from lambdas.users_delete import handler as users_delete
from lambdas.users_delete.handler import handler as delete_handler
from tests.conftest import (
    AVATARS_BUCKET,
    BOARD_TABLE,
    GROUPS_TABLE,
    SCORES_TABLE,
    SOCIAL_TABLE,
    USERS_TABLE,
)
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask, block, call
from tests.test_group_management import invite, manage, member_subs
from tests.test_groups import create, join, mine
from tests.test_notifications import notes

USERNAME = "google_1234567890"
POOL_ID = "us-east-1_EXAMPLE"
TABLES = (USERS_TABLE, SCORES_TABLE, BOARD_TABLE, SOCIAL_TABLE, GROUPS_TABLE)


@pytest.fixture
def pool(people, monkeypatch):
    """
    Cognito, stubbed against the real API model: moto's cognito-idp needs extras
    CI doesn't install. Queue each AdminDeleteUser answer the test expects.
    """
    client = boto3.client("cognito-idp")
    stub = Stubber(client)
    stub.activate()
    monkeypatch.setenv("COGNITO_USER_POOL_ID", POOL_ID)
    monkeypatch.setattr(users_delete, "cognito", lambda: client)
    yield stub
    stub.assert_no_pending_responses()


def deletes_login(stub) -> None:
    stub.add_response("admin_delete_user", {}, {"UserPoolId": POOL_ID, "Username": USERNAME})


def delete(sub=A, **overrides) -> tuple[int, dict]:
    event = authorized_event(path="/users/delete", method="POST", sub=sub)
    event["requestContext"]["authorizer"]["claims"].update(overrides)
    return call(delete_handler, event)


def everything(aws) -> list[dict]:
    return [i for t in TABLES for i in aws.Table(t).scan()["Items"]]


def mentions(aws, sub) -> list[dict]:
    return [i for i in everything(aws) if sub in json.dumps(i, default=str)]


def photos() -> list[str]:
    listed = boto3.client("s3").list_objects_v2(Bucket=AVATARS_BUCKET)
    return [o["Key"] for o in listed.get("Contents", [])]


def put_scores(aws, sub, value=7) -> None:
    scores, board = aws.Table(SCORES_TABLE), aws.Table(BOARD_TABLE)
    scores.put_item(Item={"pk": "EP#dwts#35#01", "sk": f"PERF#c1#1#USER#{sub}", "value": value})
    scores.put_item(Item={"pk": "EP#tus#4#02", "sk": f"EVT#RT#USER#{sub}", "picks": ["p1"]})
    scores.put_item(Item={"pk": "WIN#tus#4", "sk": f"USER#{sub}", "picks": ["p2"]})
    for pk, sk in (
        ("ERR#dwts#35#01", f"c1#1#USER#{sub}"),
        ("BOARD#dwts#35", f"USER#{sub}"),
        ("BOARD#dwts#all", f"USER#{sub}"),
        ("PTS#tus#4#02", f"RT#USER#{sub}"),
        ("BOARD#tus#4", f"USER#{sub}"),
    ):
        board.put_item(Item={"pk": pk, "sk": sk, "n": 1})


def test_everything_naming_the_caller_goes_and_nothing_else(aws, pool):
    ask(A, B)
    accept(B, A)
    ask(C, A)
    gid = create()[1]["data"]
    join(gid["inviteCode"], sub=B)
    put_scores(aws, A)
    put_scores(aws, B, value=9)
    s3 = boto3.client("s3")
    mine_key, theirs = f"avatars/{A}/{'a' * 32}.jpg", f"avatars/{B}/{'b' * 32}.jpg"
    for key in (mine_key, f"avatars/{A}/{'c' * 32}.png", theirs):
        s3.put_object(Bucket=AVATARS_BUCKET, Key=key, Body=b"img")
    before = len(everything(aws))
    deletes_login(pool)

    status, body = delete()

    assert status == 200, body
    assert body["data"] == {"ok": True}
    assert mentions(aws, A) == []
    assert photos() == [theirs]
    assert aws.Table(USERS_TABLE).get_item(Key={"sub": B}).get("Item")
    assert len(everything(aws)) < before
    # B's scores and board rows are untouched, so crowd means and B's place hold.
    b_scores = [i for i in everything(aws) if i.get("pk", "").startswith(("EP#", "WIN#"))]
    assert {i["sk"] for i in b_scores} == {
        f"PERF#c1#1#USER#{B}",
        f"EVT#RT#USER#{B}",
        f"USER#{B}",
    }
    assert (
        len([i for i in everything(aws) if i.get("pk", "").startswith(("ERR#", "PTS#", "BOARD#"))])
        == 5
    )
    assert notes(B)[0] == []
    assert notes(C)[0] == []


def test_an_owned_group_passes_to_the_longest_standing_member(aws, pool):
    gid = create()[1]["data"]
    join(gid["inviteCode"], sub=B)
    join(gid["inviteCode"], sub=C)
    aws.Table(GROUPS_TABLE).update_item(
        Key={"pk": f"GROUP#{gid['id']}", "sk": f"MEMBER#{C}"},
        UpdateExpression="SET joinedAt = :t",
        ExpressionAttributeValues={":t": "2020-01-01T00:00:00+00:00"},
    )
    deletes_login(pool)

    assert delete()[0] == 200

    (group,) = mine(C)
    assert group["owner"] == C
    assert sorted(member_subs(C)) == [B, C]
    assert mentions(aws, A) == []


def test_a_group_the_caller_is_alone_in_is_deleted(aws, pool):
    gid = create()[1]["data"]
    deletes_login(pool)
    assert delete()[0] == 200
    assert everything(aws) and not [
        i
        for i in everything(aws)
        if gid["id"] in i.get("pk", "") or gid["inviteCode"] in i.get("pk", "")
    ]


def test_memberships_invites_and_requests_elsewhere_go(aws, pool):
    ask(A, B)
    accept(B, A)
    ask(A, C)
    accept(C, A)
    bea = create("Bea's", sub=B)[1]["data"]
    join(bea["inviteCode"], sub=A)
    invite(bea["id"], C, by=A)
    cee = create("Cee's", sub=C)[1]["data"]
    invite(cee["id"], A, by=C)
    adam = create("Adam's", sub=C)[1]["data"]
    manage(adam["id"], "approval", by=C, approval=True)
    join(adam["inviteCode"], sub=A)
    deletes_login(pool)

    assert delete()[0] == 200

    assert mentions(aws, A) == []
    assert member_subs(B) == [B]
    assert all(g["invited"] == [] and g["requests"] == [] for g in mine(C))
    assert notes(C)[0] == []


def test_blocks_go_both_ways(aws, pool):
    block(A, B)
    block(C, A)
    deletes_login(pool)
    assert delete()[0] == 200
    assert mentions(aws, A) == []


def test_a_retry_after_the_login_went_is_harmless(aws, pool):
    deletes_login(pool)
    pool.add_client_error("admin_delete_user", "UserNotFoundException")
    assert delete()[0] == 200
    assert delete()[0] == 200


def test_a_cognito_failure_is_500_and_can_be_retried(aws, pool):
    ask(A, B)
    pool.add_client_error("admin_delete_user", "InternalErrorException", http_status_code=500)
    assert delete()[0] == 500
    assert mentions(aws, A) == []
    deletes_login(pool)
    assert delete()[0] == 200


def test_no_username_is_401_and_deletes_nothing(aws, pool):
    before = everything(aws)
    status, _ = delete(**{"cognito:username": None})
    assert status == 401
    assert everything(aws) == before
