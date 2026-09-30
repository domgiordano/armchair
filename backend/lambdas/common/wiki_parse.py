"""Parses one week's score tables out of a Dancing with the Stars season page's wikitext.

Pure functions, no network. Real-revision fixtures live in fixtures/wiki/.
"""

from __future__ import annotations

import re
from decimal import Decimal

PANEL_LINE = re.compile(r"listed in this order from left to right:\s*(.+)")
NUM = r"\d+(?:\.\d+)?"
SCORE = re.compile(rf"^({NUM})\s*\(({NUM}(?:\s*,\s*{NUM})*)\)$")
BONUS = re.compile(r"^\d+$")
SPAN = re.compile(r'(row|col)span\s*=\s*"?(\d+)')
TEMPLATE = re.compile(r"\{\{([^{}]*)\}\}")
LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]")


def clean(text: str) -> str:
    text = re.sub(r"<ref[^>]*?/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)
    # Innermost first, so {{nowrap|39 (10, 10, 9{{efn|...}}, 10)}} loses the efn and keeps the score.
    while (stripped := TEMPLATE.sub(unwrap, text)) != text:
        text = stripped
    return LINK.sub(r"\1", text)


def unwrap(m: re.Match) -> str:
    name, _, body = m.group(1).partition("|")
    return body if name.strip().lower() == "nowrap" else ""


def cell_text(raw: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", raw)
    text = re.sub(r"<[^>]+>|'''|''", "", text)
    return "\n".join(line.strip() for line in text.split("\n") if line.strip())


def parse_cell(raw: str, header: bool) -> dict:
    attrs, sep, body = raw.partition("|")
    if not sep:
        attrs, body = "", raw
    spans = {kind: int(n) for kind, n in SPAN.findall(attrs)}
    return {
        "text": cell_text(body),
        "header": header,
        "rows": spans.get("row", 1),
        "cols": spans.get("col", 1),
    }


def tables(section: str) -> list[list[list[dict]]]:
    """Every `{| ... |}` in the section as its rows, each row a list of cells."""
    found: list[list[list[dict]]] = []
    table: list[list[dict]] | None = None
    for line in section.split("\n"):
        s = line.strip()
        if s.startswith("{|"):
            table = [[]]
            found.append(table)
        elif table is None:
            continue
        elif s.startswith("|}"):
            table = None
        elif s.startswith("|+"):
            continue
        elif s.startswith("|-"):
            table.append([])
        elif s.startswith(("!", "|")):
            header = s[0] == "!"
            parts = re.split(r"!!|\|\|" if header else r"\|\|", s[1:])
            table[-1].extend(parse_cell(p, header) for p in parts)
        elif table[-1]:
            table[-1][-1]["text"] += "\n" + cell_text(s)
    return [[r for r in t if r] for t in found]


def expand(rows: list[list[dict]]) -> list[list[dict]]:
    """Lays rows out on a grid so rowspan/colspan cells land in every column they cover."""
    carried: dict[int, list] = {}
    grid = []
    for row in rows:
        out: list[dict] = []
        cells = iter(row)
        while True:
            col = len(out)
            if col in carried:
                cell, left = carried[col]
                out.append(cell)
                carried[col][1] -= 1
                if left == 1:
                    del carried[col]
                continue
            cell = next(cells, None)
            if cell is None:
                break
            for i in range(cell["cols"]):
                out.append(cell)
                if cell["rows"] > 1:
                    carried[col + i] = [cell, cell["rows"] - 1]
        grid.append(out)
    return grid


def resolve(couple: str, aliases: dict[str, str]) -> str | None:
    """Row headers read "<celebrity> & <pro>"; the celebrity part is the alias."""
    celeb = couple.split("&")[0]
    return aliases.get(norm(celeb))


def norm(name: str) -> str:
    return " ".join(name.split()).casefold()


def check(total: Decimal, judges: list[Decimal], panel: list[str]) -> str | None:
    if len(judges) != len(panel):
        return f"{len(judges)} judge values for a panel of {len(panel)}"
    if any(not 1 <= v <= 10 or (v * 2) % 1 for v in judges):
        return "judge value outside 1-10 in 0.5 steps"
    if sum(judges) != total:
        return f"judge values sum to {sum(judges)}, total is {total}"
    return None


def panel_of(text: str) -> list[str]:
    m = PANEL_LINE.search(clean(text))
    if not m:
        return []
    names = cell_text(m.group(1)).rstrip(".")
    return [n.strip() for n in names.split(",")]


def score_tables(section: str) -> list[tuple[list[list[dict]], list[str]]]:
    """(data rows, column names) for each table with Couple and Scores columns, matched by name."""
    found = []
    for t in tables(section):
        header = next((r for r in t if all(c["header"] for c in r)), None)
        if header is None:
            continue
        names = [c["text"].lower() for c in expand([header])[0]]
        if "couple" in names and "scores" in names:
            found.append((t[t.index(header) + 1 :], names))
    return found


def parse_week(wikitext: str, week: int, aliases: dict[str, str]) -> dict | None:
    """Performances and rejected rows for `=== Week N`, or None if the heading isn't on the page.

    `aliases` maps a celebrity's short name as Wikipedia writes it ("Connor W.") to a contestant id.
    """
    text = re.sub(r"<!--.*?-->", "", wikitext, flags=re.DOTALL)
    head = re.search(rf"^===\s*Week {week}(?!\d).*$", text, flags=re.MULTILINE)
    if not head:
        return None
    rest = text[head.end() :]
    end = re.search(r"^==", rest, flags=re.MULTILINE)
    section = rest[: end.start() if end else len(rest)]
    first_week = re.search(r"^===\s*Week", text, flags=re.MULTILINE)
    # A guest- or absent-judge week has its own order line; otherwise the page-level one applies.
    panel = panel_of(section.split("{|")[0]) or panel_of(text[: first_week.start()])

    aliases = {norm(k): v for k, v in aliases.items()}
    performances: list[dict] = []
    rejected: list[dict] = []
    for night, (rows, names) in enumerate(score_tables(clean(section)), start=1):
        for row in expand(rows):
            couple = row[names.index("couple")]["text"]
            score = row[names.index("scores")]["text"]
            fail = {"night": night, "row": couple}

            # A team dance lists each couple on its own line; a host on the team has no "&".
            couples = [c for c in couple.split("\n") if "&" in c] or [couple]
            ids = [resolve(c, aliases) for c in couples]
            if None in ids:
                rejected.append({**fail, "reason": "unknown couple"})
                continue

            if BONUS.match(score):
                prior = [p for p in performances if p["contestants"] == ids]
                if not prior:
                    rejected.append({**fail, "reason": "bonus row with no dance to attach to"})
                    continue
                prior[-1]["bonus"] = int(score)
                continue

            total = judges = None
            if score:
                m = SCORE.match(score)
                if not m:
                    rejected.append({**fail, "reason": f"unparseable score {score!r}"})
                    continue
                total = Decimal(m.group(1))
                judges = [Decimal(v) for v in m.group(2).split(",")]
                if reason := check(total, judges, panel):
                    rejected.append({**fail, "reason": reason})
                    continue

            performances.append(
                {
                    "night": night,
                    "contestants": ids,
                    "n": 1 + sum(p["contestants"] == ids for p in performances),
                    "rateable": len(ids) == 1,
                    "total": total,
                    "judges": judges,
                    "bonus": None,
                }
            )

    return {"week": week, "panel": panel, "performances": performances, "rejected": rejected}
