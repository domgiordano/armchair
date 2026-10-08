"""
POST /admin/email-test - preview any email template, and optionally send it to yourself. Admins only.

Body: {"template": "<name>", "send": false}. `template` is a sample from
common/email_samples.py: dwts-tonight, dwts-closing, dwts-digest,
dwts-digest-unrevealed, traitors-tonight, traitors-digest, ... An unknown or
missing name is a 400 whose detail lists them all. With "send": true the email
goes to the caller's own address only, outside the sent log, so a test can be
re-sent. Its unsubscribe links are real and act on the caller.

Response: {template, show, kind, from, subject, preheader, html, text, sent, to}.
"""

from __future__ import annotations

from lambdas.common import mailer
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.email_samples import SAMPLES


@api_handler("admin_email_test")
def handler(event, context):
    address = require_admin(event)
    sub = caller_sub(event)
    req = body(event)
    name = req.get("template")
    if name not in SAMPLES:
        raise ValidationError(
            "template must be one of the samples", field="template", templates=sorted(SAMPLES)
        )
    send = req.get("send", False)
    if type(send) is not bool:
        raise ValidationError("send must be true or false", field="send")

    show, kind, ctx = SAMPLES[name]
    email = mailer.render(sub, show, kind, ctx)
    if send:
        mailer.send(address, sub, show, kind, email)
    return ok(
        {
            "template": name,
            "show": show,
            "kind": kind,
            "from": mailer.sender(show, kind),
            "subject": email.subject,
            "preheader": email.preheader,
            "html": email.html,
            "text": email.text,
            "sent": send,
            "to": address if send else None,
        }
    )
