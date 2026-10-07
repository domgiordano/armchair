"""
GET /invite/preview?code=<inviteCode> - the link preview for a group invite.

Public, since chat apps fetch it without a token. The site is a static export,
so /join/ has one Open Graph card for every group; this page names the group,
then sends the browser on to /join/?code=. An unknown code gets the generic
card and the same redirect, and the join screen says the link is bad.
"""

from __future__ import annotations

import json
import re
from html import escape
from urllib.parse import quote

from lambdas.common.api import allow_origin, api_handler, query
from lambdas.common.groups_dynamo import by_code

CODE = re.compile(r"[A-Za-z0-9_-]{16}")
DESCRIPTION = "Rate Dancing with the Stars with your friends on Armchair Judge"

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Armchair Judge">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{image}">
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
    # The first allowed origin is the DWTS site (locals.tf), the same fallback
    # allow_origin uses for a request with no Origin.
    site = allow_origin({})
    param = quote(code, safe="")
    target = f"{site}/join/?code={param}"
    # og:url is this page, not /join/: Facebook re-scrapes og:url and would
    # land on the static card.
    host = event["requestContext"]["domainName"]
    page = PAGE.format(
        title=escape(title),
        description=escape(DESCRIPTION),
        image=f"{site}/opengraph-image.jpg",
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
