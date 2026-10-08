"""
Each show's email look, from its app's palette: DWTS from frontend/app/globals.css
(ballroom navy, gold, mirror-ball silver), Traitors from traitors/app/globals.css
(night stone, cloak green, candle gold). Nothing here is generic Armchair.
"""

from __future__ import annotations

import os

THEMES = {
    "dwts": {
        "show": "dwts",
        "name": "Dancing with the Stars",
        "short": "DWTS",
        "digestSubject": "Your {label} DWTS results are in",
        "page": "#02081e",
        "card": "#0a1440",
        "panel": "#111d55",
        "text": "#f3f1ea",
        "muted": "#9aa5c0",
        "accent": "#e8c268",
        "accentSoft": "#f7e2a4",
        "button": "#e8c268",
        "buttonText": "#0a1440",
        "rule": "#b8892f",
        "alert": "#ff4d5e",
        "display": "'Archivo Black','Arial Black',Arial,Helvetica,sans-serif",
        "body": "Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif",
        "displayCase": "uppercase",
        "mark": "/email/dwts-mark.png",
        "settings": "/profile/#settings",
        "siteEnv": "DWTS_URL",
    },
    "traitors": {
        "show": "traitors",
        "name": "The Traitors",
        "short": "The Traitors",
        "digestSubject": "The Traitors: your {label} results are in",
        "page": "#0a0d0b",
        "card": "#151a17",
        "panel": "#13281d",
        "text": "#eadbb8",
        "muted": "#9a9c92",
        "accent": "#e9b949",
        "accentSoft": "#ffd27a",
        "button": "#c79a3a",
        "buttonText": "#0a0d0b",
        "rule": "#1e4a33",
        "alert": "#e0464f",
        "display": "Cinzel,'Trajan Pro',Georgia,'Times New Roman',serif",
        "body": "'EB Garamond',Georgia,'Times New Roman',serif",
        "displayCase": "uppercase",
        "mark": "/email/traitors-mark.png",
        "settings": "/settings/",
        "siteEnv": "TRAITORS_URL",
    },
}


def theme(show: str) -> dict:
    t = THEMES[show]
    return {**t, "site": os.environ[t["siteEnv"]]}


def show_of(scope_or_type: str) -> str:
    """The show a type or scope belongs to; social and all fall back to DWTS."""
    head = scope_or_type.split(".")[0]
    return head if head in THEMES else "dwts"
