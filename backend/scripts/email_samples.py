"""
Sample contexts for every email, per show: the snapshot tests render these, and
render_emails.py turns them into HTML and PNG for review. Names are invented.
"""

from __future__ import annotations

DWTS = "https://dwts.armchairjudge.com"
TRAITORS = "https://traitors.armchairjudge.com"

_dwts_group = {
    "name": "Ballroom Bandits",
    "rows": [
        {"rank": 1, "name": "Maya R.", "value": "1.21 off", "move": 1},
        {"rank": 2, "name": "Jordan P.", "value": "1.38 off", "move": 1, "me": True},
        {"rank": 3, "name": "Sam T.", "value": "1.52 off", "move": -2},
    ],
}
_traitors_group = {
    "name": "Round Table Regulars",
    "rows": [
        {"rank": 1, "name": "Jordan P.", "value": "41 pts", "move": 2, "me": True},
        {"rank": 2, "name": "Priya K.", "value": "38 pts", "move": -1},
        {"rank": 3, "name": "Leo M.", "value": "30 pts", "move": -1},
    ],
}

SAMPLES = {
    "dwts-tonight": (
        "dwts",
        "tonight",
        {"label": "Week 4", "when": "8:00 pm ET", "verb": "score", "url": f"{DWTS}/episode/?season=dwts-35&ep=04"},
    ),
    "traitors-tonight": (
        "traitors",
        "tonight",
        {"label": "Episode 6", "when": "9:00 pm ET", "verb": "pick", "url": f"{TRAITORS}/episode/?ep=6&season=tus-5"},
    ),
    "dwts-closing": (
        "dwts",
        "closing",
        {"label": "Week 4", "days": 2, "answered": 5, "rateable": 11, "url": f"{DWTS}/episode/?season=dwts-35&ep=04"},
    ),
    "dwts-digest": (
        "dwts",
        "digest",
        {
            "label": "Week 4",
            "revealed": True,
            "through": None,
            "url": f"{DWTS}/leaderboard/",
            "you": {
                "cells": [("This week", "1.38 off"), ("Rank", "#4 of 37"), ("Move", "up 2")],
                "line": "Across 11 dances you were 1.38 points off the judges on average. Closest call: a perfect match on 3 dances.",
            },
            "groups": [_dwts_group],
            "global": {
                "rows": [
                    {"rank": 1, "name": "Ellis W.", "value": "0.97 off", "move": 0},
                    {"rank": 2, "name": "Maya R.", "value": "1.10 off", "move": 3},
                    {"rank": 3, "name": "Chris D.", "value": "1.14 off", "move": -1},
                    {"rank": 4, "name": "Jordan P.", "value": "1.21 off", "move": 2, "me": True},
                ]
            },
            "top": [
                {"rank": 1, "name": "Maya R.", "value": "0.64 off"},
                {"rank": 2, "name": "Ellis W.", "value": "0.81 off"},
                {"rank": 3, "name": "Taylor B.", "value": "0.88 off"},
            ],
        },
    ),
    "dwts-digest-unrevealed": (
        "dwts",
        "digest",
        {
            "label": "Week 4",
            "revealed": False,
            "through": "Week 3",
            "url": f"{DWTS}/episode/?season=dwts-35&ep=04",
            "you": {
                "cells": [("Season", "1.29 off"), ("Rank", "#6 of 35")],
                "line": "Through Week 3 you were 1.29 points off the judges on average.",
            },
            "groups": [
                {
                    "name": "Ballroom Bandits",
                    "rows": [
                        {"rank": 1, "name": "Maya R.", "value": "1.18 off", "move": 0},
                        {"rank": 2, "name": "Sam T.", "value": "1.24 off", "move": 1},
                        {"rank": 3, "name": "Jordan P.", "value": "1.29 off", "move": -1, "me": True},
                    ],
                }
            ],
            "global": None,
            "top": None,
        },
    ),
    "traitors-digest": (
        "traitors",
        "digest",
        {
            "label": "Episodes 4-5",
            "revealed": True,
            "through": None,
            "url": f"{TRAITORS}/leaderboard/?season=tus-5",
            "you": {
                "cells": [("This week", "+14 pts"), ("Season", "41 pts"), ("Rank", "#2 of 24")],
                "line": "You called 2 of 3 round tables and earned 14 points this week.",
            },
            "groups": [_traitors_group],
            "global": {
                "rows": [
                    {"rank": 1, "name": "Avery S.", "value": "44 pts", "move": 0},
                    {"rank": 2, "name": "Jordan P.", "value": "41 pts", "move": 3, "me": True},
                    {"rank": 3, "name": "Priya K.", "value": "38 pts", "move": -1},
                ]
            },
            "top": [
                {"rank": 1, "name": "Jordan P.", "value": "+14 pts"},
                {"rank": 2, "name": "Morgan F.", "value": "+12 pts"},
                {"rank": 3, "name": "Avery S.", "value": "+11 pts"},
            ],
        },
    ),
    "traitors-digest-unrevealed": (
        "traitors",
        "digest",
        {
            "label": "Episodes 4-5",
            "revealed": False,
            "through": "Episode 3",
            "url": f"{TRAITORS}/episode/?ep=4&season=tus-5",
            "you": {
                "cells": [("Season", "27 pts"), ("Rank", "#5 of 22")],
                "line": "Through Episode 3 you had 27 points.",
            },
            "groups": [
                {
                    "name": "Round Table Regulars",
                    "rows": [
                        {"rank": 1, "name": "Priya K.", "value": "31 pts", "move": 0},
                        {"rank": 2, "name": "Jordan P.", "value": "27 pts", "move": 1, "me": True},
                        {"rank": 3, "name": "Leo M.", "value": "22 pts", "move": -1},
                    ],
                }
            ],
            "global": None,
            "top": None,
        },
    ),
    "dwts-group-invite": (
        "dwts",
        "group_invite",
        {"inviter": "Maya R.", "group": "Ballroom Bandits", "url": f"{DWTS}/notifications/"},
    ),
    "traitors-group-invite": (
        "traitors",
        "group_invite",
        {"inviter": "Priya K.", "group": "Round Table Regulars", "url": f"{TRAITORS}/"},
    ),
    "dwts-friend-request": (
        "dwts",
        "friend_request",
        {"requester": "Sam T.", "url": f"{DWTS}/notifications/"},
    ),
    "traitors-friend-request": (
        "traitors",
        "friend_request",
        {"requester": "Leo M.", "url": f"{TRAITORS}/"},
    ),
    "dwts-group-activated": (
        "dwts",
        "group_activated",
        {"actor": "Maya R.", "group": "Ballroom Bandits", "url": f"{DWTS}/groups/?group=SAMPLEGROUP1"},
    ),
    "traitors-group-activated": (
        "traitors",
        "group_activated",
        {"actor": "Priya K.", "group": "Round Table Regulars", "url": f"{TRAITORS}/groups/?group=SAMPLEGROUP1"},
    ),
}
