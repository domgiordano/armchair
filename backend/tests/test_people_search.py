"""/people/search against moto with the person index from every fixture."""

import json
from decimal import Decimal

import pytest

from lambdas.people_search.handler import handler
from scripts.seed_season import SEASONS
from scripts.seed_season import people as person_index
from tests.conftest import CATALOG_TABLE
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask, block, call

FIXTURES = [json.loads(p.read_text(), parse_float=Decimal) for p in SEASONS.glob("*.json")]
INDEX = [r for r in person_index(FIXTURES, {}) if r["pk"] == "PEOPLE#dwts"]


@pytest.fixture
def index(aws, people):
    """Only the search rows: writing every PERSON item too would slow each test down."""
    with aws.Table(CATALOG_TABLE).batch_writer() as batch:
        for row in INDEX:
            batch.put_item(Item=row)


def find(q, sub=A) -> tuple[int, dict]:
    return call(handler, authorized_event(path="/people/search", sub=sub, query={"q": q}))


def ids(data, group):
    return [p["id"] for p in data[group]]


@pytest.mark.parametrize("q", ["", "a", " a ", "x" * 41])
def test_q_must_be_two_to_forty_characters(index, q):
    status, body = find(q)
    assert status == 400
    assert body["error"]["detail"] == {"field": "q"}


def test_a_person_sits_in_the_group_of_their_latest_role(index):
    data = find("derek h")[1]["data"]
    assert ids(data, "judges") == ["derek-hough"]
    assert "derek-hough" not in ids(data, "pros")
    assert data["judges"][0]["roles"] == ["judge", "pro"]


def test_word_prefix_ranks_after_name_prefix_then_latest_season(index):
    data = find("hough")[1]["data"]
    # Neither name starts with "hough"; Derek judged more recently than Julianne.
    assert ids(data, "judges")[:2] == ["derek-hough", "julianne-hough"]


def test_contains_matches_rank_last_and_fold_apostrophes(index):
    stars = ids(find("amelio")[1]["data"], "stars")
    assert {"charli-damelio", "heidi-damelio"} <= set(stars)
    assert ids(find("d'amel")[1]["data"], "stars")[:2] == ["charli-damelio", "heidi-damelio"]


def test_accents_fold(index):
    assert "edyta-sliwinska" in ids(find("sliwi")[1]["data"], "pros")


def test_people_rows_carry_a_headshot_image_and_seasons(index):
    judge = find("bruno")[1]["data"]["judges"][0]
    assert judge == {
        "id": "bruno-tonioli",
        "name": "Bruno Tonioli",
        "roles": ["judge"],
        "headshot": "supplied/bruno-tonioli-ffd9a03e76.webp",
        "seasons": list(range(1, 36)),
    }


def test_users_by_name_prefix_never_the_caller_never_an_email(index):
    status, body = find("ad")
    assert status == 200
    assert [u["sub"] for u in body["data"]["users"]] == [C]
    assert body["data"]["users"][0] == {
        "sub": C,
        "name": "Adam Driver",
        "picture": body["data"]["users"][0]["picture"],
        "avatarKind": "google",
        "status": None,
    }
    assert "email" not in json.dumps(body)


def test_friends_match_anywhere_in_their_name(index):
    assert find("arthur")[1]["data"]["users"] == []
    ask(A, B)
    accept(B, A)
    users = find("arthur")[1]["data"]["users"]
    assert [(u["sub"], u["status"]) for u in users] == [(B, "friend")]
    # A stranger still only matches from the start of their name.
    assert find("driver")[1]["data"]["users"] == []


def test_a_block_either_way_hides_the_user(index):
    block(C, A)
    assert find("adam")[1]["data"]["users"] == []
    assert find("ada", sub=C)[1]["data"]["users"] == []


def test_people_and_users_are_capped_per_group(index):
    data = find("an")[1]["data"]
    assert all(len(data[g]) <= 8 for g in ("users", "stars", "pros", "judges"))
    assert len(data["stars"]) == 8
