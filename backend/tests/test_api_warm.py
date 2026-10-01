"""The warmer schedule's ping (infrastructure/terraform/warmer.tf)."""

from lambdas.overview_get.handler import handler


def test_a_warm_ping_returns_before_auth_or_reads(aws):
    assert handler({"warm": True}, None) == {"warm": True}


def test_an_api_event_is_never_taken_for_a_ping(aws):
    res = handler({"warm": "true", "queryStringParameters": {"season": "dwts-35"}}, None)
    assert res["statusCode"] == 401
