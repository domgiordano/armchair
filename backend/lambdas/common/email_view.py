"""The caller's email settings as /email/prefs and /email/prefs-set return them."""

from __future__ import annotations

from lambdas.common.email_dynamo import is_suppressed
from lambdas.common.email_prefs import with_defaults


def settings_view(row: dict) -> dict:
    address = row.get("email")
    return {
        "address": address,
        "prefs": with_defaults(row.get("emailPrefs")),
        "noticeSeen": bool(row.get("emailNoticeAt")),
        # SES reported this address as bouncing or complaining: no toggle will reach it.
        "suppressed": bool(address) and is_suppressed(address),
    }
