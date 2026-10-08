"""
GET /invite/preview?code=<inviteCode>&site=<origin> - the link preview for a group invite.

Public, since chat apps fetch it without a token. The site is a static export,
so /join/ has one Open Graph card for every group; this page names the group,
then sends the browser on to /join/?code= on the show site that made the link
(`site`, one of the allowed origins; any other value means DWTS). An unknown
code gets the generic card and the same redirect, and the join screen says the
link is bad.
"""

from __future__ import annotations

import json
import re
from html import escape
from urllib.parse import quote

from lambdas.common.api import allow_origin, api_handler, query
from lambdas.common.groups_dynamo import by_code

CODE = re.compile(r"[A-Za-z0-9_-]{16}")
DESCRIPTION = "Score every Dancing with the Stars dance together, then see who called it closest."
TRAITORS = "Call The Traitors with your friends on Armchair Judge"
DWTS_SITE_NAME = "Armchair Judge · Dancing with the Stars"

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta name="theme-color" content="#02081e">
<meta property="og:site_name" content="{site_name}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{image}">
<meta http-equiv="refresh" content="0; url={target}">
</head>
<body>
<script>location.replace({target_js})</script>
<p><a href="{target}">Open the invite on Armchair Judge</a></p>
</body>
</html>
"""


@api_handler("invite_preview")
def handler(event, context):
    code = query(event).get("code") or ""
    group = by_code(code) if CODE.fullmatch(code) else None
    title = f"Join {group['name']}" if group else "Join a group on Armchair Judge"
    # The first allowed origin is the DWTS site (locals.tf): the card's image, and
    # where a link from before `site` existed goes.
    primary = allow_origin({})
    site = allow_origin({"headers": {"origin": query(event).get("site")}})
    param = quote(code, safe="")
    target = f"{site}/join/?code={param}"
    # og:url is this page, not /join/: Facebook re-scrapes og:url and would
    # land on the static card.
    host = event["requestContext"]["domainName"]
    traitors = "traitors" in site
    if not traitors:
        title += " · Dancing with the Stars"
    # DWTS gets its /join/ card (frontend/scripts/og). The Traitors site has no
    # card of its own yet, so its links show the hub's family card.
    image = (
        f"{primary.replace('://dwts.', '://', 1)}/opengraph-image.jpg"
        if traitors
        else f"{primary}/join/opengraph-image.jpg"
    )
    page = PAGE.format(
        title=escape(title),
        description=escape(TRAITORS if traitors else DESCRIPTION),
        site_name="Armchair Judge" if traitors else escape(DWTS_SITE_NAME),
        image=image,
        url=escape(f"https://{host}/invite/preview?code={param}"),
        target=escape(target),
        target_js=json.dumps(target),
    )
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300"},
        "body": page,
        "isBase64Encoded": False,
    }
