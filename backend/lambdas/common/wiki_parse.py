"""Parses one week's score tables out of a Dancing with the Stars season page's wikitext.

Pure functions, no network. Real-revision fixtures live in fixtures/wiki/.
"""

from __future__ import annotations

import re
from decimal import Decimal

# "listed in this order from left to right: ...", "given in this order from left to right: ..."
PANEL_LINE = re.compile(r"from left to right:\s*(.+)")
NUM = r"\d+(?:\.\d+)?"
# X marks a judge sitting a dance out (S20 week 9: judges didn't score the couple they coached).
VALUE = rf"(?:{NUM}|X)"
SCORE = re.compile(rf"^({NUM})\s*\(({VALUE}(?:\s*,\s*{VALUE})*)\)(?:\s*\+\s*(\d+))?$")
BONUS = re.compile(r"^\d+$")
UNSCORED = re.compile(r"^no scores", re.IGNORECASE)
NIGHT = re.compile(r"night\s*(\d+)", re.IGNORECASE)
ONLY = re.compile(r"\s*\(night (\d+) only\)", re.IGNORECASE)
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
    name = name.strip().lower()
    if name == "sortname":
        return " ".join(body.split("|")[:2])
    return body if name == "nowrap" else ""


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


def blocks(section: str) -> list[dict]:
    """Every `{| ... |}` in the section: its rows, its caption, and the text since the last table."""
    found: list[dict] = []
    text: list[str] = []
    table: dict | None = None
    for line in section.split("\n"):
        s = line.strip()
        if s.startswith("{|"):
            table = {"before": "\n".join(text), "caption": "", "rows": [[]]}
            found.append(table)
            text = []
        elif table is None:
            text.append(line)
        elif s.startswith("|}"):
            table = None
        elif s.startswith("|+"):
            table["caption"] += cell_text(s[2:])
        elif s.startswith("|-"):
            table["rows"].append([])
        elif s.startswith(("!", "|")):
            header = s[0] == "!"
            parts = re.split(r"!!|\|\|" if header else r"\|\|", s[1:])
            table["rows"][-1].extend(parse_cell(p, header) for p in parts)
        elif table["rows"][-1]:
            table["rows"][-1][-1]["text"] += "\n" + cell_text(s)
    for t in found:
        t["rows"] = [r for r in t["rows"] if r]
    return found


def tables(section: str) -> list[list[list[dict]]]:
    """Every `{| ... |}` in the section as its rows, each row a list of cells."""
    return [b["rows"] for b in blocks(section)]


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


def check(total: Decimal, judges: list[Decimal | None], panel: list[str]) -> str | None:
    if len(judges) != len(panel):
        return f"{len(judges)} judge values for a panel of {len(panel)}"
    given = [v for v in judges if v is not None]
    if any(not 1 <= v <= 10 or (v * 2) % 1 for v in given):
        return "judge value outside 1-10 in 0.5 steps"
    if sum(given) != total:
        return f"judge values sum to {sum(given)}, total is {total}"
    return None


def panel_of(text: str) -> list[str]:
    m = PANEL_LINE.search(clean(text))
    if not m:
        return []
    names = cell_text(m.group(1)).rstrip(".")
    return [n.strip() for n in names.split(",")]


def seated(panel: list[str], night: int) -> list[str]:
    """The panel on one night: S25 week 10 lists "Julianne Hough (Night 1 only)"."""
    out = []
    for name in panel:
        m = ONLY.search(name)
        if m and int(m.group(1)) != night:
            continue
        out.append(ONLY.sub("", name))
    return out


def layout(rows: list[list[dict]]) -> dict | None:
    """
    Column layout of a score table, or None if it has no Couple and Scores columns.

    Usually one Scores column holds `total (a, b, c)`. S15 instead spans Scores over one
    column per judge, named in a second header row, with the total in its own column.
    """
    start = next((i for i, r in enumerate(rows) if all(c["header"] for c in r)), None)
    if start is None:
        return None
    end = start
    while end < len(rows) and all(c["header"] for c in rows[end]):
        end += 1
    grid = expand(rows[start:end])
    top = [c["text"].lower() for c in grid[0]]
    names = [c["text"].lower() for c in grid[-1]]
    score = next((i for i, n in enumerate(top) if "score" in n and "total" not in n), None)
    if "couple" not in names or score is None:
        return None
    judges = [i for i, c in enumerate(grid[0]) if c is grid[0][score]]
    split = len(judges) > 1
    return {
        "rows": rows[end:],
        "names": names,
        "score": score,
        "judges": judges if split else [],
        "panel": [grid[-1][i]["text"] for i in judges] if split else [],
        "total": next((i for i, n in enumerate(names) if "total" in n), None) if split else None,
    }


def score_tables(section: str) -> list[tuple[list[list[dict]], list[str]]]:
    """(data rows, column names) for each table with Couple and Scores columns, matched by name."""
    return [(t["rows"], t["names"]) for b in blocks(section) if (t := layout(b["rows"]))]


def column(row: list[dict], names: list[str], want: str) -> str | None:
    """Text of the first column whose header contains `want` ("Mariah Carey music" is the music)."""
    i = next((i for i, name in enumerate(names) if want in name), None)
    if i is None or i >= len(row):
        return None
    return row[i]["text"] or None


def value(text: str) -> Decimal | None:
    return None if text == "X" else Decimal(text)


def read_score(row: list[dict], lay: dict) -> tuple[str, object]:
    """
    One row's score cell(s) as (kind, payload): ("empty", None), ("bonus", points),
    ("unscored", None), ("scored", (total, judges, bonus)) or ("bad", reason).
    """
    if lay["judges"]:
        first = row[lay["judges"][0]]
        if first["cols"] > 1 and BONUS.match(first["text"]):
            return "bonus", int(first["text"])
        cells = [row[i]["text"] for i in lay["judges"]]
        total = row[lay["total"]]["text"] if lay["total"] is not None else ""
        if not any(cells) and not total:
            return "empty", None
        if UNSCORED.match(cells[0]):
            return "unscored", None
        if not all(re.fullmatch(VALUE, c) for c in cells) or not re.fullmatch(NUM, total):
            return "bad", f"unparseable score {' | '.join(cells + [total])!r}"
        return "scored", (Decimal(total), [value(c) for c in cells], None)

    text = row[lay["score"]]["text"]
    if not text:
        return "empty", None
    if BONUS.match(text):
        return "bonus", int(text)
    if UNSCORED.match(text):
        return "unscored", None
    m = SCORE.match(text)
    if not m:
        return "bad", f"unparseable score {text!r}"
    judges = [value(v.strip()) for v in m.group(2).split(",")]
    return "scored", (Decimal(m.group(1)), judges, m.group(3) and int(m.group(3)))


def parse_week(wikitext: str, week: int, aliases: dict[str, str]) -> dict | None:
    """Performances and rejected rows for `=== Week N`, or None if the heading isn't on the page.

    `aliases` maps a celebrity's short name as Wikipedia writes it ("Connor W.") to a contestant id.
    Each performance carries the panel that scored it: a judge-order line applies to every table
    after it in the week, so a guest judge can join mid-week. Nights are counted from ";Night 2"
    labels, "(Night 2)" captions and scored "Dance-off" tables, not from tables: S11 week 7 has
    two tables on one night.
    `unscored` lists rows the page marks "No scores received", like S1's group Viennese waltz.
    """
    text = re.sub(r"<!--.*?-->", "", wikitext, flags=re.DOTALL)
    head = re.search(rf"^===\s*Week {week}(?!\d).*$", text, flags=re.MULTILINE)
    if not head:
        return None
    rest = text[head.end() :]
    end = re.search(r"^==", rest, flags=re.MULTILINE)
    section = rest[: end.start() if end else len(rest)]
    first_week = re.search(r"^===\s*Week", text, flags=re.MULTILINE)
    panel = panel_of(text[: first_week.start()])

    aliases = {norm(k): v for k, v in aliases.items()}
    week_panel: list[str] | None = None
    performances: list[dict] = []
    rejected: list[dict] = []
    unscored: list[dict] = []
    night = 0
    for block in blocks(clean(section)):
        panel = panel_of(block["before"]) or panel
        labels = [
            line
            for line in block["before"].split("\n")
            if line.startswith(";") and "night" in line.lower()
        ]
        labels += [block["caption"]] if NIGHT.search(block["caption"]) else []
        for label in labels:
            m = NIGHT.search(label)
            night = int(m.group(1)) if m else night + 1
        night = max(night, 1)

        lay = layout(block["rows"])
        if lay is None:
            continue
        # S8's scored dance-offs aired on the results show, a night of their own.
        if not labels and "dance-off" in block["caption"].lower():
            night += 1
        seats = lay["panel"] or seated(panel, night)
        if week_panel is None:
            week_panel = seats
        names = lay["names"]
        for row in expand(lay["rows"]):
            couple = row[names.index("couple")]["text"]
            fail = {"night": night, "row": couple}

            # A team dance lists each couple on its own line; a host on the team has no "&".
            couples = [c for c in couple.split("\n") if "&" in c] or [couple]
            ids = [resolve(c, aliases) for c in couples]
            if None in ids:
                rejected.append({**fail, "reason": "unknown couple"})
                continue

            kind, got = read_score(row, lay)
            if kind == "bad":
                rejected.append({**fail, "reason": got})
                continue
            if kind == "unscored":
                unscored.append(fail)
                continue
            if kind == "bonus":
                prior = [p for p in performances if p["contestants"] == ids]
                if not prior:
                    rejected.append({**fail, "reason": "bonus row with no dance to attach to"})
                    continue
                prior[-1]["bonus"] = got
                continue

            total = judges = bonus = None
            if kind == "scored":
                total, judges, bonus = got
                if reason := check(total, judges, seats):
                    rejected.append({**fail, "reason": reason})
                    continue

            performances.append(
                {
                    "night": night,
                    # Where the row sits in its night's table: the running order, once
                    # editors set it (cron_poll_wiki.running).
                    "order": 1 + sum(p["night"] == night for p in performances),
                    "contestants": ids,
                    "n": 1 + sum(p["contestants"] == ids for p in performances),
                    # Every dance the judges score counts, a team dance included. One the page
                    # marks "No scores received" went to `unscored` above.
                    "rateable": True,
                    "panel": seats,
                    "total": total,
                    "judges": judges,
                    "bonus": bonus,
                    "style": column(row, names, "dance"),
                    "song": column(row, names, "music"),
                    "result": column(row, names, "result"),
                }
            )

    return {
        "week": week,
        "panel": week_panel if week_panel is not None else seated(panel, 1),
        "performances": performances,
        "rejected": rejected,
        "unscored": unscored,
    }
