import re
from html import unescape

from lambdas.invite_preview.handler import handler
from tests.test_groups import create

SITE = "https://dwts.armchairjudge.com"


def preview(code, site=None) -> dict:
    params = {k: v for k, v in {"code": code, "site": site}.items() if v is not None}
    event = {
        "path": "/invite/preview",
        "httpMethod": "GET",
        "headers": {"Host": "api.dwts.armchairjudge.com"},
        "queryStringParameters": params or None,
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
    assert meta(page, "og:title") == "Join Couch Crew · Dancing with the Stars"
    assert meta(page, "twitter:title") == "Join Couch Crew · Dancing with the Stars"
    assert meta(page, "og:site_name") == "Armchair Judge · Dancing with the Stars"
    assert "Dancing with the Stars" in meta(page, "og:description")
    assert meta(page, "og:image") == f"{SITE}/join/opengraph-image.jpg"
    assert meta(page, "twitter:image") == f"{SITE}/join/opengraph-image.jpg"
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
    assert "<title>Join &lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt; · Dancing with the Stars</title>" in page
    assert meta(page, "og:title") == 'Join <b>"Tom & Jerry"</b> · Dancing with the Stars'


def test_unknown_code_gets_the_generic_card_and_still_redirects(aws):
    page = preview("A" * 16)["body"]
    assert meta(page, "og:title") == "Join a group on Armchair Judge · Dancing with the Stars"
    assert f"{SITE}/join/?code={'A' * 16}" in page


def test_a_hostile_code_is_neither_looked_up_nor_injected(aws):
    page = preview('"><script>alert(1)</script>')["body"]
    assert meta(page, "og:title") == "Join a group on Armchair Judge · Dancing with the Stars"
    assert "<script>alert" not in page
    assert '"><' not in page
    assert f"{SITE}/join/?code=%22%3E%3Cscript%3Ealert%281%29%3C%2Fscript%3E" in page


def test_no_code_still_redirects_to_join(aws):
    page = preview(None)["body"]
    assert meta(page, "og:title") == "Join a group on Armchair Judge · Dancing with the Stars"
    assert f'location.replace("{SITE}/join/?code=")' in page


def test_a_traitors_link_joins_on_the_traitors_site(aws, monkeypatch):
    traitors = "https://traitors.armchairjudge.com"
    monkeypatch.setenv("CORS_ALLOW_ORIGIN", f"{SITE},{traitors}")
    code = create(name="Castle Crew")[1]["data"]["inviteCode"]
    page = preview(code, site=traitors)["body"]
    assert meta(page, "og:title") == "Join Castle Crew · The Traitors"
    assert meta(page, "og:description").startswith("Call The Traitors with the group")
    assert meta(page, "og:site_name") == "Armchair Judge · The Traitors"
    assert meta(page, "og:image") == f"{traitors}/join/opengraph-image.jpg"
    assert meta(page, "twitter:image") == f"{traitors}/join/opengraph-image.jpg"
    assert f'location.replace("{traitors}/join/?code={code}")' in page
    # A site that isn't ours falls back to DWTS rather than redirecting anywhere asked.
    assert f'location.replace("{SITE}/join/?code={code}")' in preview(code, site="https://evil.example")["body"]
