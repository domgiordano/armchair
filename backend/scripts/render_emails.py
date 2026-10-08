"""
Renders every sample email (email_samples.py) to HTML, text and a phone-width
PNG for review. Needs `pip install playwright` and a Chromium; pass
--chromium to reuse one already on disk.

    python -m scripts.render_emails out/ [--chromium /path/to/chrome-headless-shell]
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from unittest import mock

from lambdas.common import mailer
from scripts.email_samples import SAMPLES

ENV = {
    "API_URL": "https://api.dwts.armchairjudge.com",
    "DWTS_URL": "https://dwts.armchairjudge.com",
    "TRAITORS_URL": "https://traitors.armchairjudge.com",
    "EMAIL_DOMAIN": "armchairjudge.com",
}
SUB = "00000000-0000-4000-8000-000000000000"
REPO = Path(__file__).resolve().parents[2]
# The marks are served by each app; until they deploy, read them from the repo.
MARKS = {
    "https://dwts.armchairjudge.com/email/dwts-mark.png": REPO / "frontend/public/email/dwts-mark.png",
    "https://traitors.armchairjudge.com/email/traitors-mark.png": REPO / "traitors/public/email/traitors-mark.png",
}


def render_all(out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    pages = []
    with mock.patch.dict(os.environ, ENV), mock.patch.object(mailer, "link", lambda s, scope, show: f"https://api.dwts.armchairjudge.com/email/unsubscribe?token=SAMPLE-{scope}&show={show}"):
        for name, (show, kind, ctx) in SAMPLES.items():
            email = mailer.render(SUB, show, kind, ctx)
            page = out / f"{name}.html"
            page.write_text(email.html)
            (out / f"{name}.txt").write_text(f"From: {mailer.sender(show, kind)}\nSubject: {email.subject}\nPreheader: {email.preheader}\n\n{email.text}")
            pages.append(page)
    return pages


def screenshot(pages: list[Path], chromium: str | None) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium)
        page = browser.new_page(viewport={"width": 414, "height": 800}, device_scale_factor=2)
        page.route("**/email/*-mark.png", lambda route: route.fulfill(path=str(MARKS[route.request.url])))
        for html in pages:
            page.goto(html.as_uri())
            page.screenshot(path=str(html.with_suffix(".png")), full_page=True)
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("out", type=Path)
    parser.add_argument("--chromium")
    args = parser.parse_args()
    screenshot(render_all(args.out), args.chromium)
    print(args.out)
