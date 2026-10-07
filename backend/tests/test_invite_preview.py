import re
from html import unescape

from lambdas.invite_preview.handler import handler
from tests.test_groups import create

SITE = "https://dwts.armchairjudge.com"


def preview(code) -> dict:
    event = {
        "path": "/invite/preview",
        "httpMethod": "GET",
        "headers": {"Host": "api.dwts.armchairjudge.com"},
        "queryStringParameters": None if code is None else {"code": code},
        "requestContext": {"domainName": "api.dwts.armchairjudge.com", "stage": "prod"},
    }
    res = handler(event, None)
    assert res["statusCode"] == 200
    assert res["headers"]["Content-Type"].startswith("text/html")
    assert res["headers"]["Cache-Control"] == "public, max-age=300"
    return res


def meta(page: str, prop: str) -> str:
    return unescape(re.search(rf'<meta (?:property|name)="{prop}" content="([^"]*)">', page).group(1))


def test_names_the_group_and_redirects_to_join(aws):
    group = create(name="Couch Crew")[1]["data"]
    code = group["inviteCode"]
    page = preview(code)["body"]
    assert meta(page, "og:title") == "Join Couch Crew"
    assert meta(page, "twitter:title") == "Join Couch Crew"
    assert meta(page, "og:description") == "Rate Dancing with the Stars with your friends on Armchair Judge"
    assert meta(page, "og:image") == f"{SITE}/opengraph-image.jpg"
    assert meta(page, "og:url") == f"https://api.dwts.armchairjudge.com/invite/preview?code={code}"
    assert f'content="0; url={SITE}/join/?code={code}"' in page
    assert f'location.replace("{SITE}/join/?code={code}")' in page


def test_escapes_the_group_name(aws):
    create(name='<b>"Tom & Jerry"</b>')
    code = aws.Table("t-armchair-groups").scan(
        FilterExpression="sk = :s", ExpressionAttributeValues={":s": "GROUP"}
    )["Items"][0]["pk"].removeprefix("INVITE#")
    page = preview(code)["body"]
    assert "<b>" not in page
    assert "<title>Join &lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;</title>" in page
    assert meta(page, "og:title") == 'Join <b>"Tom & Jerry"</b>'


def test_unknown_code_gets_the_generic_card_and_still_redirects(aws):
    page = preview("A" * 16)["body"]
    assert meta(page, "og:title") == "Join a group on Armchair Judge"
    assert f"{SITE}/join/?code={'A' * 16}" in page


def test_a_hostile_code_is_neither_looked_up_nor_injected(aws):
    page = preview('"><script>alert(1)</script>')["body"]
    assert meta(page, "og:title") == "Join a group on Armchair Judge"
    assert "<script>alert" not in page
    assert '"><' not in page
    assert f"{SITE}/join/?code=%22%3E%3Cscript%3Ealert%281%29%3C%2Fscript%3E" in page


def test_no_code_still_redirects_to_join(aws):
    page = preview(None)["body"]
    assert meta(page, "og:title") == "Join a group on Armchair Judge"
    assert f'location.replace("{SITE}/join/?code=")' in page
