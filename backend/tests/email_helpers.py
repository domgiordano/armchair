"""Shared setup for the scheduled-email tests: a stub SES and seeded readers."""

import pytest

from lambdas.common import mailer


@pytest.fixture
def outbox(aws, unsubscribe_secret, monkeypatch):
    """Every send as (to, subject, html); production access unless a test says otherwise."""
    monkeypatch.setenv("EMAIL_DOMAIN", "armchairjudge.com")
    monkeypatch.setenv("EMAIL_CONFIG_SET", "armchair-mail")
    monkeypatch.setattr(mailer, "production", lambda: True)
    monkeypatch.setattr(mailer, "_admins", lambda: frozenset())
    sent = []

    def send(address, sub, show, kind, email):
        sent.append({"to": address, "sub": sub, "show": show, "kind": kind, "email": email})

    monkeypatch.setattr(mailer, "send", send)
    return sent
