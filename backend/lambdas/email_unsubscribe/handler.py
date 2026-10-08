"""
GET|POST /email/unsubscribe?token=...&show=dwts|traitors - turn off one email
type, a whole show's email, or all of it, with no sign-in.

The route has no authorizer: the signed token (common/unsubscribe.py) is the
only credential, and all it can do is turn email off. `show` only picks the
page's look.

GET never changes anything, because link scanners prefetch GETs. It renders a
confirmation page whose form POSTs the token back. POST does the unsubscribe,
and serves both that form (`application/x-www-form-urlencoded`, token in the
body or query string) and RFC 8058 one-click, which mail clients send to the
List-Unsubscribe URL with the body `List-Unsubscribe=One-Click`.

Responses are small HTML pages, not the JSON envelope, because a person reads them.
"""

from __future__ import annotations

import base64
import html
from urllib.parse import parse_qs

from lambdas.common.api import api_handler, query
from lambdas.common.email_prefs import covered, describe, with_defaults
from lambdas.common.email_theme import THEMES, theme
from lambdas.common.unsubscribe import verify
from lambdas.common.users_dynamo import email_settings, set_email_settings

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<title>{title} - {name}</title>
<style>
body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem;
  box-sizing: border-box; font: 16px/1.5 {body}; background: {page}; color: {text}; }}
main {{ max-width: 26rem; width: 100%; padding: 1.5rem; border-radius: 12px; background: {card};
  border-top: 3px solid {accent}; }}
.show {{ margin: 0 0 1rem; font: 13px {display}; letter-spacing: 0.14em; text-transform: uppercase;
  color: {accent}; }}
h1 {{ margin: 0 0 0.5rem; font: 22px/1.25 {display}; color: {text}; }}
p {{ margin: 0 0 1rem; color: {text}; }}
.muted {{ color: {muted}; font-size: 14px; }}
a {{ color: {accent}; font-weight: 600; }}
button {{ min-height: 2.75rem; padding: 0 1.25rem; font: 600 16px {body}; border: 0; border-radius: 8px;
  background: {button}; color: {buttonText}; cursor: pointer; }}
button:focus-visible, a:focus-visible {{ outline: 2px solid {accentSoft}; outline-offset: 3px; }}
</style>
</head>
<body>
<main>
<p class="show">{name} &middot; Armchair Judge</p>
<h1>{title}</h1>
{content}
<p class="muted">Change any email type in Settings at <a href="{site}{settings}">{host}</a>.</p>
</main>
</body>
</html>"""

FORM = """<form method="post">
<input type="hidden" name="token" value="{token}">
<button type="submit">Unsubscribe</button>
</form>"""


def _page(status: int, show: str, title: str, content: str) -> dict:
    t = theme(show)
    return {
        "statusCode": status,
        "headers": {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
        "body": PAGE.format(
            **t, title=title, content=content, host=t["site"].removeprefix("https://")
        ),
        "isBase64Encoded": False,
    }


def _form_token(event: dict) -> str:
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    return (parse_qs(raw).get("token") or [""])[0]


@api_handler("email_unsubscribe")
def handler(event, context):
    params = query(event)
    show = params.get("show") if params.get("show") in THEMES else "dwts"
    # The route is ANY, since the module gives each path one method.
    method = event.get("httpMethod")
    if method not in ("GET", "POST"):
        return _page(405, show, "Not allowed", "<p>Open the unsubscribe link from your email.</p>")

    token = params.get("token") or (_form_token(event) if method == "POST" else "")
    parsed = verify(token)
    if parsed is None:
        return _page(
            400, show, "Link not valid", "<p>Copy the whole unsubscribe link from the email.</p>"
        )
    sub, scope = parsed

    if method == "GET":
        content = f"<p>Stop {describe(scope)}?</p>" + FORM.format(token=html.escape(token))
        return _page(200, show, "Unsubscribe", content)

    row = email_settings(sub)
    if row is None:
        return _page(404, show, "Not found", "<p>That account is gone, so it gets no email.</p>")
    prefs = with_defaults(row.get("emailPrefs"))
    set_email_settings(sub, {**prefs, **dict.fromkeys(covered(scope), False)}, None)
    return _page(200, show, "Unsubscribed", f"<p>You won&rsquo;t get {describe(scope)} any more.</p>")
