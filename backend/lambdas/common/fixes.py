"""
An admin's view of, and fix to, one user's answers in one episode: DWTS scores and
Traitors picks. Used by admin_answers (read) and admin_answer (write).

An episode taking answers ("live") can be fixed outright. One whose window has
closed, or a finished season ("closed"), needs `override` with `confirm: "OVERRIDE"`.
One not yet aired ("upcoming") can't be answered by anyone and isn't fixable. Only
the user's own rows are read or returned, never anyone else's answers or a result.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import board_dynamo, traitors_board, window
from lambdas.common.api import ConflictError, ValidationError
from lambdas.common.dynamo import table
from lambdas.common.episodes_dynamo import episode_pk, episode_rows, performances, ref, season_rows
from lambdas.common.gate import cid, rateable
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_dynamo import episode, season_parts
from lambdas.common.traitors_gate import PICKS, closed, events, roster

KEEP = ("value", "forfeit", "picks", "submittedAt", "adminBy", "adminAt")


class Episode:
    """One episode of either show, its state, and the user's rows in it."""

    def __init__(self, data: dict, sub: str):
        self.show, self.season, self.ep = ref(data)
        if self.show != "dwts" and self.show not in EDITIONS:
            raise ValidationError("season must be a DWTS or Traitors season", field="season")
        self.sub = sub
        self.pk = episode_pk(self.show, self.season, self.ep)
        rows = season_rows(self.show, self.season)
        now = window.now()
        if self.show == "dwts":
            self.meta, self.episode, contestants = episode_rows(
                rows, self.show, self.season, self.ep
            )
            span = window.spans(self.meta, rows)[self.ep]
            if window.is_live(self.meta, span, now):
                self.state = "live"
            elif window.closed(self.meta, span, now):
                self.state = "closed"
            else:
                self.state = "upcoming"
            names = {
                cid(c): " & ".join(m["name"] for m in c.get("members", [])) for c in contestants
            }
            keys = rateable(self.ep, self.episode, contestants, performances(self.pk))
            self.slots = [
                {
                    "key": k,
                    "label": " / ".join(names.get(c, c) for c in k.partition("#")[0].split("+")),
                }
                for k in keys
            ]
        else:
            self.meta, episodes, players = season_parts(rows, self.show, self.season)
            self.episode = episode(episodes, self.ep, self.show, self.season)
            released = self.episode["releaseAt"] <= now.astimezone(UTC).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
            self.state = (
                "closed" if closed(self.meta, self.episode) else "live" if released else "upcoming"
            )
            self.roster = roster(self.ep, players)
            self.slots = [{"key": k, "label": k, "picks": PICKS[k]} for k in events(self.episode)]

    def sk(self, key: str) -> str:
        return (
            f"PERF#{key}#USER#{self.sub}" if self.show == "dwts" else f"EVT#{key}#USER#{self.sub}"
        )

    def answer(self, key: str) -> dict | None:
        row = (
            table("SCORES_TABLE")
            .get_item(Key={"pk": self.pk, "sk": self.sk(key)}, ConsistentRead=True)
            .get("Item")
        )
        return row and {k: row[k] for k in KEEP if k in row}

    def view(self) -> dict:
        out = {
            "season": f"{self.show}-{self.season}",
            "ep": self.ep,
            "app": "dwts" if self.show == "dwts" else "traitors",
            "state": self.state,
            "slots": [{**s, "answer": self.answer(s["key"])} for s in self.slots],
        }
        if self.show != "dwts":
            out["roster"] = self.roster
        return out

    def given(self, data: dict) -> dict | None:
        """The answer to store from a request, or None to clear it."""
        if data.get("clear") is True:
            return None
        if data.get("forfeit") is True:
            return {"forfeit": True}
        if self.show == "dwts":
            value = data.get("value")
            if type(value) is not int or not 1 <= value <= 10:
                raise ValidationError(
                    "Send value 1-10, forfeit: true or clear: true", field="value"
                )
            return {"value": value}
        key = data.get("key")
        picks = data.get("picks")
        allowed = {p["id"] for p in self.roster}
        if (
            not isinstance(picks, list)
            or len(picks) != PICKS[key]
            or len(set(picks)) != len(picks)
            or not all(isinstance(p, str) and p in allowed for p in picks)
        ):
            raise ValidationError(
                f"{key} takes {PICKS[key]} different players still in the game", field="picks"
            )
        return {"picks": picks}

    def fix(self, data: dict, admin: str) -> tuple[dict | None, dict | None]:
        """Writes or clears the user's answer for `key`, then re-counts the board. (before, after)."""
        key = data.get("key")
        if key not in {s["key"] for s in self.slots}:
            raise ValidationError(
                "key is not one of this episode's performances or events", field="key"
            )
        if self.state == "upcoming":
            raise ConflictError(
                "This episode hasn't aired; nobody can answer it yet", code="episode_not_open"
            )
        if self.state == "closed" and not (
            data.get("override") is True and data.get("confirm") == "OVERRIDE"
        ):
            raise ConflictError(
                "This episode is closed. Send override: true and confirm: OVERRIDE to change it anyway",
                code="needs_override",
            )
        new = self.given(data)
        before = self.answer(key)
        tbl = table("SCORES_TABLE")
        if new is None:
            tbl.delete_item(Key={"pk": self.pk, "sk": self.sk(key)})
        else:
            now = datetime.now(UTC).isoformat(timespec="seconds")
            submitted = (before or {}).get("submittedAt") or now
            tbl.put_item(
                Item={
                    "pk": self.pk,
                    "sk": self.sk(key),
                    **new,
                    "submittedAt": submitted,
                    "adminBy": admin,
                    "adminAt": now,
                }
            )
        if self.show == "dwts":
            board_dynamo.reconcile(
                self.show,
                self.season,
                self.ep,
                self.episode.get("panel") or self.meta["defaultPanel"],
            )
        else:
            traitors_board.reconcile(self.show, self.season, self.ep)
        return before, self.answer(key)
