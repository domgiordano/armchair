"""
AI write-ups of each dance: what the routine was, what stood out, and what the
judges said, written by Claude from recap excerpts (common/recaps.py).

The model may only restate the excerpts, and validate() distrusts it anyway.
Keys and judge ids come back from a closed enum. A field that names a number
other than this dance's confirmed scores, names another couple, or mentions a
result (who went home, the leaderboard) is dropped: results open per episode,
write-ups per dance (gate.py), so a write-up must never carry one. A quote
that isn't in the excerpts word for word is dropped.
"""

from __future__ import annotations

import re
from decimal import Decimal

from lambdas.common import claude

TOOL = "record_writeups"
MAX_TOKENS = 12_000
SUMMARY_CHARS = 600
SENTENCES = 3
JUDGE_CHARS = 220
QUOTE_WORDS = 6
HIGHLIGHTS = 3
HIGHLIGHT_CHARS = 32

SYSTEM = """You write short write-ups of Dancing with the Stars performances for a companion app, working only from excerpts of published recaps given to you.

Rules:
- Use only facts stated in that performance's excerpts. Never add anything from memory or inference. If the excerpts don't say something, leave it out. If they say nothing usable about the dance, return null for summary and empty lists.
- The excerpts were cut from articles by name and may include passages about other couples, other weeks or rehearsals. Use only what is clearly about this couple's dance on this night. The style, song and judges' scores given are confirmed: a passage describing a different dance or different scores is about something else, so ignore it.
- summary: 2 to 3 sentences in your own words on what the routine was (concept, story, staging, music) and what happened or stood out. Do not copy sentences from the sources.
- judges: one entry for each judge the excerpts report commenting on this dance, with a paraphrase of what they said in your own words, at most 25 words. quote is at most 6 words copied exactly from the excerpt as that judge's own words, or null. Leave out judges the excerpts don't cover.
- highlights: up to 3 chips of 1 to 4 words naming standout moments, such as "Lift into the finale".
- sources: the URLs of the excerpts you used.
- Never mention a number or score of any kind, the leaderboard, a result of the night, or who was eliminated, sent home, safe or in the bottom. The app reveals those separately. Never mention another couple.
- Don't refer to the recaps or their writers. Write plainly, in the past tense."""

NULLABLE = {"anyOf": [{"type": "string"}, {"type": "null"}]}
NUMBER = re.compile(r"\d+(?:\.\d+)?")
# Above any total: a decade ("'90s") or a year, never a score.
SCORE_MAX = 40
WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}
SPOKEN = re.compile(
    r"\b(?:scored?|gave\s+\w+|earned|got)\s+(?:a|an|all|straight)?\s*(one|two|three|four|five|six|seven|eight|nine|ten)s?\b"
    r"|\b(one|two|three|four|five|six|seven|eight|nine|ten)s?\s+(?:from|out of|across)\b",
    re.IGNORECASE,
)
PERFECT = re.compile(r"\bperfect\s+(?:score|tens?|30|40|20)\b", re.IGNORECASE)
RESULTS = re.compile(
    r"eliminat|\b(?:sent|send|went|goes|going|go)\s+home\b|\bbottom\s+(?:two|three|2|3)\b"
    r"|leaderboard|\bimmunity\b|\bjudges'? save\b",
    re.IGNORECASE,
)


def schema(keys: list[str], panel: list[str], urls: list[str]) -> dict:
    """The forced tool. Strict, so keys, judge ids and URLs can only be ones we sent."""
    item = {
        "type": "object",
        "additionalProperties": False,
        "required": ["key", "summary", "judges", "highlights", "sources"],
        "properties": {
            "key": {"type": "string", "enum": keys},
            "summary": NULLABLE,
            "judges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["judge", "paraphrase", "quote"],
                    "properties": {
                        "judge": {"type": "string", "enum": panel},
                        "paraphrase": {"type": "string"},
                        "quote": NULLABLE,
                    },
                },
            },
            "highlights": {"type": "array", "items": {"type": "string"}},
            "sources": {"type": "array", "items": {"type": "string", "enum": urls}},
        },
    }
    return {
        "name": TOOL,
        "description": "Record one write-up for each performance given.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["writeups"],
            "properties": {"writeups": {"type": "array", "items": item}},
        },
    }


def facts(
    perf: dict,
    panel: list[str],
    contestants: dict[str, dict],
    judges: dict[str, str],
    excerpts: list[tuple[str, str]],
) -> dict:
    """
    What the prompt and validate() know about one performance. `contestants`
    is every couple of the season by id, `judges` judge names by id, and
    `excerpts` (url, text) pairs cut for this dance's couples.
    """
    values = {j: perf["judges"][j]["value"] for j in panel}
    total = sum(values.values())
    mine = set(perf["contestants"])
    members = [m for c in mine for m in contestants[c]["members"]]
    own = {w for m in members for w in m["name"].replace(" Jr.", "").split()}
    others = sorted(
        {
            name
            for cid, c in contestants.items()
            if cid not in mine
            for m in c["members"]
            for name in _names(m["name"])
            if name not in own
        }
    )
    allowed = {_num(v) for v in values.values()} | {_num(total), _num(10 * len(panel))}
    return {
        "key": perf["sk"].removeprefix("PERF#"),
        "members": members,
        "style": perf.get("style"),
        "song": perf.get("song"),
        "judges": [(j, judges.get(j, j), values[j]) for j in panel],
        "total": total,
        "max": 10 * len(panel),
        "allowed": allowed,
        "others": others,
        "excerpts": excerpts,
    }


def _names(name: str) -> set[str]:
    """A rival's full name and a last name long enough not to be a common word."""
    words = name.replace(" Jr.", "").split()
    return {name} | ({words[-1]} if len(words) > 1 and len(words[-1]) >= 4 else set())


def _num(v: Decimal | float) -> str:
    return f"{Decimal(str(v)).normalize():f}"


def request(perfs: list[dict], panel: list[str], week: int | None, theme: str | None) -> dict:
    """The Messages request for one episode's performances, each built by facts()."""
    blocks = []
    for f in perfs:
        dancers = " and ".join(f"{m['name']} ({m['role']})" for m in f["members"])
        scores = ", ".join(f"{name} {_num(v)}" for _, name, v in f["judges"])
        parts = [
            f'<performance key="{f["key"]}">',
            f"Dancers: {dancers}",
            f"Dance: {f['style'] or 'unknown style'} to {f['song'] or 'an unknown song'}",
            f"Judges' confirmed scores: {scores}; total {_num(f['total'])} of {f['max']}",
            f"Judge ids: {', '.join(j for j, _, _ in f['judges'])}",
        ]
        parts += [f'<excerpt url="{url}">\n{text}\n</excerpt>' for url, text in f["excerpts"]]
        parts.append("</performance>")
        blocks.append("\n".join(parts))
    night = f"Week {week}" + (f", {theme} night" if theme else "")
    urls = sorted({url for f in perfs for url, _ in f["excerpts"]})
    return {
        "model": claude.MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM,
        "tools": [schema([f["key"] for f in perfs], panel, urls)],
        "tool_choice": {"type": "tool", "name": TOOL},
        "messages": [
            {
                "role": "user",
                "content": f"{night}. Write one write-up per performance.\n\n"
                + "\n\n".join(blocks),
            }
        ],
    }


def _fold(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return " ".join(re.sub(r"[^\w' ]+", " ", text.casefold()).split())


def clean(text: str | None, f: dict) -> str | None:
    """The text, or None when it names a wrong score, a result or another couple."""
    if not isinstance(text, str) or not text.strip():
        return None
    text = " ".join(text.split())
    numbers = {_num(Decimal(n)) for n in NUMBER.findall(text) if Decimal(n) <= SCORE_MAX}
    spoken = {str(WORDS[(a or b).lower()]) for a, b in SPOKEN.findall(text)}
    if not (numbers | spoken) <= f["allowed"]:
        return None
    if PERFECT.search(text) and f["total"] != f["max"]:
        return None
    if RESULTS.search(text):
        return None
    if any(re.search(rf"(?<!\w){re.escape(n)}(?!\w)", text) for n in f["others"]):
        return None
    return text


def _sentences(text: str) -> int:
    return len(re.findall(r"[.!?](?:\s|$)", text)) or 1


def validate(raw: dict, perfs: list[dict]) -> tuple[dict[str, dict], int]:
    """
    ({key: write-up}, fields dropped) from the tool input. Every key asked for
    gets an entry, empty when nothing survived, so it isn't paid for twice.
    """
    by_key = {f["key"]: f for f in perfs}
    seen: dict[str, dict] = {}
    for w in raw.get("writeups") or []:
        if isinstance(w, dict) and w.get("key") in by_key and w["key"] not in seen:
            seen[w["key"]] = w
    out: dict[str, dict] = {}
    dropped = 0
    for key, f in by_key.items():
        w = seen.get(key, {})
        summary = clean(w.get("summary"), f)
        if summary and (len(summary) > SUMMARY_CHARS or _sentences(summary) > SENTENCES + 1):
            summary = None
        if summary is None and w.get("summary"):
            dropped += 1

        source = _fold(" ".join(text for _, text in f["excerpts"]))
        panel = {j for j, _, _ in f["judges"]}
        judges, said = [], set()
        for j in w.get("judges") or []:
            text = clean(j.get("paraphrase"), f)
            if (
                j.get("judge") not in panel
                or j["judge"] in said
                or not text
                or len(text) > JUDGE_CHARS
            ):
                dropped += 1
                continue
            said.add(j["judge"])
            quote = clean(j.get("quote"), f)
            quote = quote and quote.strip(" \"'“”")
            if quote and (len(quote.split()) > QUOTE_WORDS or _fold(quote) not in source):
                dropped += 1
                quote = None
            judges.append({"judge": j["judge"], "text": text, "quote": quote or None})

        highlights = []
        for h in (w.get("highlights") or [])[:HIGHLIGHTS]:
            chip = clean(h, f)
            if chip and len(chip) <= HIGHLIGHT_CHARS:
                highlights.append(chip)
            else:
                dropped += 1

        given = [url for url, _ in f["excerpts"]]
        sources = [u for u in given if u in (w.get("sources") or [])] or given
        empty = summary is None and not judges and not highlights
        out[key] = {
            "summary": summary,
            "judges": judges,
            "highlights": highlights,
            "sources": [] if empty else sources,
        }
    return out, dropped
