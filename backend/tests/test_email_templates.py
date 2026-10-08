"""
Template snapshots per show. A changed template fails here until the snapshot is
regenerated on purpose: UPDATE_SNAPSHOTS=1 pytest tests/test_email_templates.py.
Review the new HTML (and scripts/render_emails.py's PNGs) before committing it.
"""

import os
from email import message_from_bytes
from pathlib import Path

import pytest

from lambdas.common import mailer
from scripts.email_samples import SAMPLES

SNAPSHOTS = Path(__file__).parent / "snapshots" / "emails"
SUB = "00000000-0000-4000-8000-000000000000"


@pytest.fixture
def env(monkeypatch):
    for k, v in {
        "API_URL": "https://api.dwts.armchairjudge.com",
        "DWTS_URL": "https://dwts.armchairjudge.com",
        "TRAITORS_URL": "https://traitors.armchairjudge.com",
        "EMAIL_DOMAIN": "armchairjudge.com",
    }.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setattr(mailer, "link", lambda s, scope, show: f"https://u.test/{scope}/{show}")


@pytest.mark.parametrize("name", sorted(SAMPLES))
def test_snapshot(env, name):
    show, kind, ctx = SAMPLES[name]
    email = mailer.render(SUB, show, kind, ctx)
    got = f"Subject: {email.subject}\nPreheader: {email.preheader}\n\n{email.text}\n{email.html}"
    path = SNAPSHOTS / f"{name}.snap"
    if os.environ.get("UPDATE_SNAPSHOTS"):
        path.write_text(got)
    assert got == path.read_text()


@pytest.mark.parametrize("name", sorted(SAMPLES))
def test_every_email_is_show_branded_with_both_unsubscribes(env, name):
    show, kind, ctx = SAMPLES[name]
    email = mailer.render(SUB, show, kind, ctx)
    other = "traitors" if show == "dwts" else "dwts"
    assert f"/email/{show}-mark.png" in email.html and f"{other}-mark" not in email.html
    ptype = mailer.pref_type(show, kind)
    scopes = (ptype, "all") if ptype in ("social", "groups") else (ptype, show)
    for scope in scopes:
        assert f"https://u.test/{scope}/{show}" in email.html
        assert f"https://u.test/{scope}/{show}" in email.text
    assert "Replies to this address aren't read" in email.text


def test_names_are_escaped(env):
    ctx = {"inviter": "<b>Eve</b>", "group": "A & B", "url": "https://dwts.armchairjudge.com/"}
    email = mailer.render(SUB, "dwts", "group_invite", ctx)
    assert "<b>Eve</b>" not in email.html and "&lt;b&gt;Eve&lt;/b&gt;" in email.html
    assert "A &amp; B" in email.html


def test_unrevealed_digest_keeps_the_week_out_of_subject_and_preview(env):
    _, _, ctx = SAMPLES["dwts-digest-unrevealed"]
    email = mailer.render(SUB, "dwts", "digest", ctx)
    assert email.subject == "Your Week 4 DWTS results are in"
    assert email.preheader == "Finish Week 4 in the app to see how you did."
    assert "nothing from it is in this email" in email.text


def test_senders_and_headers(env, monkeypatch):
    sent = []

    class Ses:
        def send_email(self, **kw):
            sent.append(kw)

    monkeypatch.setenv("EMAIL_CONFIG_SET", "armchair-mail")
    monkeypatch.setattr(mailer, "_ses", lambda: Ses())
    show, kind, ctx = SAMPLES["traitors-tonight"]
    mailer.send("a@example.com", SUB, show, kind, mailer.render(SUB, show, kind, ctx))
    show, kind, ctx = SAMPLES["dwts-friend-request"]
    mailer.send("a@example.com", SUB, show, kind, mailer.render(SUB, show, kind, ctx))

    traitors, social = (message_from_bytes(s["Content"]["Raw"]["Data"]) for s in sent)
    assert "traitors@armchairjudge.com" in traitors["From"]
    assert "The Traitors" in str(traitors["From"]) or "=?utf-8?" in traitors["From"]
    assert traitors["Reply-To"] == "noreply@armchairjudge.com"
    assert traitors["List-Unsubscribe"] == "<https://u.test/traitors/traitors>"
    assert traitors["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert social["From"] == "Armchair Judge <noreply@armchairjudge.com>"
    assert social["List-Unsubscribe"] == "<https://u.test/social/dwts>"
    assert all(s["ConfigurationSetName"] == "armchair-mail" for s in sent)
