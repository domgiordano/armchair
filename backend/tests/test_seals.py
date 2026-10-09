"""/seals/list, /seals/seal and /seals/reveal: the caller's face-down answers, kept on
their users row so every device and every gated read sees the same ones."""

import json

import pytest

from lambdas.seals_list.handler import handler as list_handler
from lambdas.seals_reveal.handler import handler as reveal_handler
from lambdas.seals_seal.handler import handler as seal_handler
from tests.conftest import USERS_TABLE
from tests.events import SUB as A
from tests.events import authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"
X = "dwts-35|6|tyler-cameron#1"
Y = "dwts-35|6|amber-glenn+ezra-sosa#1"
Z = "dwts-35|7|amber-glenn#2"
T = "tus-5|3|RT"


@pytest.fixture
def users(aws):
    for sub in (A, B):
        aws.Table(USERS_TABLE).put_item(Item={"sub": sub, "email": f"{sub}@x"})
    return aws


def call(handler, sub=A, method="POST", body=None, query=None) -> tuple[int, dict]:
    event = authorized_event(path="/seals", method=method, sub=sub, body=body, query=query)
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def held(app="dwts", sub=A) -> list[str]:
    status, body = call(list_handler, sub, "GET", query={"app": app})
    assert status == 200, body
    return body["data"]["sealed"]


def seal(*ids, app="dwts", sub=A) -> list[str]:
    status, body = call(seal_handler, sub, body={"app": app, "ids": list(ids)})
    assert status == 200, body
    return body["data"]["sealed"]


def test_seal_then_list_from_another_device(users):
    assert seal(X) == [X]
    assert seal(X, Y) == sorted([X, Y])
    assert held() == sorted([X, Y])
    assert held(sub=B) == []


def test_each_app_lists_only_its_own(users):
    seal(X)
    assert seal(T, app="traitors") == [T]
    assert held("dwts") == [X]
    assert held("traitors") == [T]


def test_reveal_one(users):
    seal(X, Y, Z)
    status, body = call(reveal_handler, body={"app": "dwts", "ids": [Y]})
    assert status == 200, body
    assert body["data"]["sealed"] == sorted([X, Z])
    assert held() == sorted([X, Z])


def test_reveal_an_episode_takes_seals_from_every_device(users):
    seal(X, Y, Z)
    status, body = call(reveal_handler, body={"app": "dwts", "season": "dwts-35", "ep": 6})
    assert status == 200, body
    assert body["data"]["sealed"] == [Z]


def test_revealing_the_last_one_leaves_none(users):
    seal(X)
    call(reveal_handler, body={"app": "dwts", "ids": [X]})
    assert held() == []
    status, body = call(reveal_handler, body={"app": "dwts", "season": "dwts-35", "ep": "06"})
    assert (status, body["data"]["sealed"]) == (200, [])


@pytest.mark.parametrize(
    "body",
    [
        {"app": "survivor", "ids": [X]},
        {"app": "dwts", "ids": []},
        {"app": "dwts", "ids": "dwts-35|6|x#1"},
        {"app": "dwts", "ids": [T]},
        {"app": "traitors", "ids": [X]},
        {"app": "dwts", "ids": ["dwts-35|6|Tyler Cameron#1"]},
        {"app": "dwts", "ids": [7]},
    ],
)
def test_bad_ids_are_400(users, body):
    status, _ = call(seal_handler, body=body)
    assert status == 400
    assert held() == []


def test_reveal_needs_ids_or_an_episode(users):
    status, _ = call(reveal_handler, body={"app": "dwts"})
    assert status == 400


def test_too_many_is_400(users, monkeypatch):
    from lambdas.common import seals

    monkeypatch.setattr(seals, "MAX", 2)
    seal(X, Y)
    status, _ = call(seal_handler, body={"app": "dwts", "ids": [Z]})
    assert status == 400
    assert held() == sorted([X, Y])


def test_no_profile_is_404_and_writes_nothing(users):
    status, _ = call(
        seal_handler, sub="3f1c2b9a-0000-4000-8000-00000000000f", body={"app": "dwts", "ids": [X]}
    )
    assert status == 404
    item = users.Table(USERS_TABLE).get_item(Key={"sub": "3f1c2b9a-0000-4000-8000-00000000000f"})
    assert "Item" not in item


def test_missing_sub_is_401(users):
    event = authorized_event(path="/seals/list", query={"app": "dwts"})
    event["requestContext"]["authorizer"]["claims"].pop("sub")
    assert list_handler(event, None)["statusCode"] == 401
