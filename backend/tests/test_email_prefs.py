from urllib.parse import parse_qs, urlparse

import pytest

from lambdas.common.email_dynamo import suppress
from lambdas.common.email_prefs import TYPES
from lambdas.common.unsubscribe import link, make_token, verify
from lambdas.email_prefs.handler import handler as prefs_handler
from lambdas.email_prefs_set.handler import handler as set_handler
from lambdas.email_unsubscribe.handler import handler as unsub_handler
from tests.events import authorized_event
from tests.social import A, call, post, sign_in


@pytest.fixture
def user(aws, unsubscribe_secret):
    sign_in(A, "Ada Lovelace")


def prefs(sub=A):
    return call(prefs_handler, authorized_event(path="/email/prefs", sub=sub))


def set_prefs(payload, sub=A):
    return post(set_handler, "/email/prefs-set", sub, payload)


def unsub(method, token, show="dwts", body=None, in_query=True):
    params = {"show": show, **({"token": token} if in_query else {})}
    event = {"httpMethod": method, "queryStringParameters": params, "body": body, "headers": {}}
    res = unsub_handler(event, None)
    return res["statusCode"], res["body"]


def test_every_type_starts_on_with_the_notice_unseen(user):
    status, out = prefs()
    assert status == 200
    assert out["data"] == {
        "address": "1@example.com",
        "prefs": dict.fromkeys(TYPES, True),
        "noticeSeen": False,
        "suppressed": False,
    }


def test_a_partial_update_keeps_the_rest_and_the_notice_sticks(user):
    status, out = set_prefs({"prefs": {"dwts.digest": False}, "noticeSeen": True})
    assert status == 200
    assert out["data"]["prefs"] == {**dict.fromkeys(TYPES, True), "dwts.digest": False}
    assert out["data"]["noticeSeen"] is True

    set_prefs({"prefs": {"social": False}})
    data = prefs()[1]["data"]
    assert data["prefs"]["dwts.digest"] is False and data["prefs"]["social"] is False
    assert data["noticeSeen"] is True


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"prefs": {}},
        {"prefs": {"dwts.digest": "false"}},
        {"prefs": {"dwts.digest": 0}},
        {"prefs": {"survivor.tonight": False}},
        {"noticeSeen": False},
    ],
)
def test_bad_updates_are_400(user, payload):
    assert set_prefs(payload)[0] == 400


def test_a_suppressed_address_says_so(user):
    suppress("1@example.com", "bounce")
    assert prefs()[1]["data"]["suppressed"] is True


def test_no_profile_is_404(aws, unsubscribe_secret):
    assert prefs()[0] == 404
    assert set_prefs({"noticeSeen": True})[0] == 404


def test_tokens_round_trip_and_reject_tampering(unsubscribe_secret):
    token = make_token(A, "dwts.tonight")
    assert verify(token) == (A, "dwts.tonight")
    payload, mac = token.split(".")
    assert verify(f"{payload}.{mac[:-1]}x") is None
    assert verify(make_token(A, "traitors").split(".")[0] + "." + mac) is None
    with pytest.raises(ValueError):
        make_token(A, "dwts.everything")


def test_the_link_carries_the_token_and_the_theme(unsubscribe_secret):
    url = urlparse(link(A, "social", "traitors"))
    assert url.netloc == "api.dwts.armchairjudge.com" and url.path == "/email/unsubscribe"
    q = parse_qs(url.query)
    assert verify(q["token"][0]) == (A, "social") and q["show"] == ["traitors"]


def test_get_only_confirms(user):
    status, page = unsub("GET", make_token(A, "dwts.tonight"))
    assert status == 200 and 'method="post"' in page
    assert "Show-night reminder" in page
    assert prefs()[1]["data"]["prefs"]["dwts.tonight"] is True


def test_one_click_post_turns_off_one_type(user):
    status, page = unsub("POST", make_token(A, "dwts.tonight"), body="List-Unsubscribe=One-Click")
    assert status == 200 and "Unsubscribed" in page
    assert prefs()[1]["data"]["prefs"] == {**dict.fromkeys(TYPES, True), "dwts.tonight": False}


def test_form_post_with_a_show_scope_turns_off_that_show(user):
    token = make_token(A, "traitors")
    status, page = unsub("POST", None, show="traitors", body=f"token={token}", in_query=False)
    assert status == 200
    # The Traitors page wears the Traitors palette.
    assert "#151a17" in page and "The Traitors &middot; Armchair Judge" in page
    off = prefs()[1]["data"]["prefs"]
    assert off["traitors.tonight"] is False and off["traitors.digest"] is False
    assert off["dwts.tonight"] is True and off["social"] is True


def test_all_turns_off_everything(user):
    unsub("POST", make_token(A, "all"))
    assert not any(prefs()[1]["data"]["prefs"].values())


def test_bad_token_and_bad_method(user):
    assert unsub("POST", "nope.nope")[0] == 400
    assert unsub("DELETE", make_token(A, "all"))[0] == 405


def test_a_deleted_account_is_404(aws, unsubscribe_secret):
    assert unsub("POST", make_token(A, "all"))[0] == 404
