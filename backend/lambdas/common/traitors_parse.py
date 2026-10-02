"""Parses a Traitors season page's wikitext: episodes, contestants, round tables, recruits.
Also an edition's main article, for its list of season pages.

Pure functions, no network. Real-revision fixtures live in fixtures/wiki/traitors-*.
Layout and special cases: docs/features/traitors/RESEARCH.md Q2.
"""

from __future__ import annotations

import re
from collections import Counter

from lambdas.common.wiki_parse import expand

SPAN = re.compile(r'(row|col)span\s*=\s*"?(\d+)')
# Attributes ahead of a template with no pipe of their own: `rowspan="2" {{N/A|''None''}}`.
LEAD_ATTRS = re.compile(r'\s*((?:[\w-]+\s*=\s*"?[^"{|]*"?\s*)+)')
TEMPLATE = re.compile(r"\{\{([^{}]*)\}\}")
LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]")
EPISODE = re.compile(r"Episode\s*(\d+)")
START_DATE = re.compile(r"\{\{\s*Start date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})")
DAGGER = re.compile(r"\{\{\s*efn\s*\|\s*name\s*=\s*\"?Dagger|\(2x\)", re.IGNORECASE)
FACTIONS = {"Faithful", "Traitor", "Accomplice"}
RECRUIT_ACTIONS = {"recruit", "seduce", "offer", "ultimatum"}
NOT_A_VOTE = {"", "TBA", "No vote", "None"}


def unwrap(m: re.Match) -> str:
    name, _, body = m.group(1).partition("|")
    name = name.strip().lower()
    parts = body.split("|")
    if name in ("nowrap", "n/a", "nobold"):
        return body
    if name == "tba":
        return "TBA"
    if name == "unbulleted list":
        return "<br>".join(p for p in parts if "=" not in p)
    if name == "font color":
        return parts[-1]
    if name == "sortname":
        return " ".join(parts[:2])
    return ""


def text(raw: str) -> str:
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.DOTALL)
    raw = re.sub(r"<ref[^>]*?/>|<ref[^>]*>.*?</ref>", "", raw, flags=re.DOTALL)
    # A struck name is a murder the Seer or a shield blocked: it didn't happen.
    raw = re.sub(r"<s>.*?</s>", "", raw, flags=re.DOTALL)
    raw = raw.replace("(2x)", "")
    while (stripped := TEMPLATE.sub(unwrap, raw)) != raw:
        raw = stripped
    raw = LINK.sub(r"\1", raw)
    raw = re.sub(r"<br\s*/?>", "\n", raw)
    raw = re.sub(r"<[^>]+>|'''|''", "", raw)
    return "\n".join(line.strip() for line in raw.split("\n") if line.strip())


def top_pipe(raw: str) -> int | None:
    depth = 0
    for i, ch in enumerate(raw):
        if raw.startswith(("{{", "[["), i):
            depth += 1
        elif raw.startswith(("}}", "]]"), i):
            depth -= 1
        elif ch == "|" and depth <= 0:
            return i
    return None


def cell(raw: str, header: bool) -> dict:
    i = top_pipe(raw)
    if i is not None and "=" in raw[:i]:
        attrs, body = raw[:i], raw[i + 1 :]
    elif i is None and "{{" in raw and (m := LEAD_ATTRS.match(raw)) and "=" in m.group(1):
        attrs, body = m.group(1), raw[m.end() :]
    else:
        attrs, body = "", raw
    spans = {kind: int(n) for kind, n in SPAN.findall(attrs)}
    return {
        "text": text(body),
        "raw": body,
        "header": header,
        "rows": spans.get("row", 1),
        "cols": spans.get("col", 1),
    }


def split_cells(line: str) -> list[str]:
    """Splits `a || b` (or `!!` in headers) at top level only, never inside a template."""
    out, depth, start, i = [], 0, 0, 0
    while i < len(line):
        two = line[i : i + 2]
        if two in ("{{", "[["):
            depth += 1
            i += 2
        elif two in ("}}", "]]"):
            depth -= 1
            i += 2
        elif two in ("||", "!!") and depth <= 0:
            out.append(line[start:i])
            start = i = i + 2
        else:
            i += 1
    out.append(line[start:])
    return out


def tables(wikitext: str) -> list[list[list[dict]]]:
    """Top-level `{| ... |}` tables, each as rows of cells. Multi-line cells are joined."""
    found: list[list[list[dict]]] = []
    rows: list[list[dict]] | None = None
    pending: tuple[str, bool] | None = None

    def flush():
        nonlocal pending
        if pending and rows is not None:
            rows[-1].append(cell(*pending))
        pending = None

    for line in wikitext.split("\n"):
        s = line.strip()
        if s.startswith("{|"):
            rows = [[]]
            found.append(rows)
        elif rows is None:
            continue
        elif s.startswith("|}"):
            flush()
            rows = None
        elif s.startswith("|+"):
            continue
        elif s.startswith("|-"):
            flush()
            rows.append([])
        elif s.startswith(("!", "|")):
            flush()
            parts = split_cells(s[1:])
            for part in parts[:-1]:
                rows[-1].append(cell(part, s[0] == "!"))
            pending = (parts[-1], s[0] == "!")
        elif pending:
            pending = (pending[0] + "\n" + s, pending[1])
    return [[r for r in t if r] for t in found]


def section(wikitext: str, *names: str) -> str:
    """Body of the first `==Name==` heading matching any name, up to the next level-2 heading."""
    for name in names:
        m = re.search(rf"^==\s*{name}\s*==\s*$", wikitext, re.MULTILINE | re.IGNORECASE)
        if m:
            end = re.search(r"^==[^=]", wikitext[m.end() :], re.MULTILINE)
            return wikitext[m.end() : m.end() + end.start()] if end else wikitext[m.end() :]
    return ""


def episodes(wikitext: str) -> list[dict]:
    """`{{Episode list}}` entries: season episode number, air date, title, and whether it's a `{{void}}` placeholder."""
    out = []
    for chunk in re.split(r"(?=\{\{\s*(?:void\s*\|\s*)?Episode list)", wikitext)[1:]:
        n = re.search(r"\|\s*EpisodeNumber2\s*=\s*(\d+)", chunk)
        date = START_DATE.search(chunk)
        if not n or not date:
            continue
        title = re.search(r"\|\s*Title\s*=\s*([^\n|]*)", chunk)
        y, m, d = (int(g) for g in date.groups())
        out.append(
            {
                "n": int(n.group(1)),
                "date": f"{y:04d}-{m:02d}-{d:02d}",
                "title": text(title.group(1)) if title else "",
                "placeholder": bool(re.match(r"\{\{\s*void", chunk)),
            }
        )
    return out


def contestants(wikitext: str) -> list[dict]:
    """The Contestants table: name, affiliations in order (a recruit may show two), and finish."""
    for rows in tables(section(wikitext, "Contestants", "Cast")):
        head = [c["text"] for c in expand(rows[:1])[0]]
        finish_at = next((i for i, h in enumerate(head) if h in ("Finish", "Status")), None)
        if "Contestant" not in head or finish_at is None:
            continue
        out = []
        for row in expand(rows)[1:]:
            name = next((c["text"] for c in row if c["header"]), row[0]["text"]).split("\n")[0]
            # "Secret Traitor" is a Traitor; a recruit's row may hold Faithful then Traitor.
            cells = {id(c): c for c in row}.values()
            sides = [f for c in cells for f in FACTIONS if c["text"].endswith(f)]
            finish = row[finish_at]["text"] if finish_at < len(row) else ""
            ep = EPISODE.search(finish)
            out.append(
                {
                    "name": name,
                    "affiliation": sides,
                    "finish": {
                        "how": finish.split("\n")[0].split(" ")[0].lower() if finish else "",
                        "ep": int(ep.group(1)) if ep else None,
                    },
                }
            )
        return out
    return []


def aliases(names: list[str]) -> dict[str, str]:
    """Short forms the elimination table uses (`Abbey B.`, `Joe`, `Maz`) mapped to full contestant names."""
    firsts = Counter(n.split()[0].lower() for n in names)
    out = {}
    for name in names:
        parts = name.split()
        out[name.lower()] = name
        if len(parts) > 1:
            out[f"{parts[0]} {parts[-1][0]}.".lower()] = name
        if firsts[parts[0].lower()] == 1:
            out[parts[0].lower()] = name
        # Marzook "Maz" Bana goes by Maz in the table.
        if nick := re.search(r'"([^"]+)"', name):
            out[nick.group(1).lower()] = name
            out[f"{nick.group(1)} {parts[-1][0]}.".lower()] = name
    return out


def resolve(names: dict[str, str], raw: str) -> str | None:
    return names.get(raw.strip().lower())


def voting_grid(wikitext: str) -> tuple[list[list[dict]], int] | None:
    """The elimination table laid out on a grid, and the index of its first data column."""
    body = section(wikitext, "Elimination history", "Voting history")
    for rows in tables(body):
        if rows and rows[0] and rows[0][0]["text"].startswith("Episode"):
            return expand(rows), rows[0][0]["cols"]
    return None


def label(row: list[dict]) -> str:
    head = next((c for c in row if c["header"]), None)
    return head["text"].replace("\n", " ") if head else ""


def round_tables(wikitext: str, names: dict[str, str]) -> list[dict]:
    """One entry per round table: its column labels, first-vote tally, declared counts and result.

    A tie opens a group that the revote and any Fate column join. The first vote decides
    the top 3; the last column decides who left.
    """
    found = voting_grid(wikitext)
    if not found:
        return []
    grid, start = found
    header = grid[0]
    by_label = {label(r).lower(): r for r in grid}
    banish, votes = by_label.get("banishment"), by_label.get("vote")
    if not banish or not votes:
        return []
    players = [r for r in grid[grid.index(votes) + 1 :] if label(r)]

    out: list[dict] = []
    for c in range(start, min(len(banish), len(header))):
        if c > start and banish[c] is banish[c - 1] and votes[c] is votes[c - 1]:
            continue
        result, declared = banish[c]["text"], votes[c]["text"]
        if result in ("None", "") and declared in ("None", ""):
            continue
        column = {"label": header[c]["text"], "result": result, "declared": declared}
        group = out[-1] if out and out[-1]["columns"][-1]["result"] == "Tie" else None
        if group:
            group["columns"].append(column)
        else:
            tally: Counter = Counter()
            unresolved = []
            for row in players:
                if c >= len(row):
                    continue
                vote = row[c]["text"]
                if vote in NOT_A_VOTE or vote.split("\n")[0] in (
                    "Banished",
                    "Murdered",
                    "Quit",
                    "Eliminated",
                ):
                    continue
                who = resolve(names, vote)
                if who is None:
                    unresolved.append(vote)
                    continue
                tally[who] += 2 if DAGGER.search(row[c]["raw"]) else 1
            counts = [int(n) for n in re.findall(r"\d+", declared)]
            group = {
                "columns": [column],
                "firstVote": dict(tally),
                "declared": counts,
                "unresolved": unresolved,
            }
            out.append(group)

    for group in out:
        last = group["columns"][-1]["result"]
        group["banished"] = resolve(names, last)
        group["fate"] = any(col["declared"].startswith("Fate") for col in group["columns"])
        group["complete"] = (
            group["banished"] is not None
            and bool(group["declared"])
            and not group["unresolved"]
            and sum(group["firstVote"].values()) == sum(group["declared"])
        )
    return out


def recruits(wikitext: str, names: dict[str, str]) -> list[dict]:
    """Recruitment decisions (`Recruit`, `Seduce`, `Offer`, `Ultimatum`) with the episode their night belongs to."""
    found = voting_grid(wikitext)
    if not found:
        return []
    grid, start = found
    header = grid[0]
    rows = [r for r in grid if "decision" in label(r).lower()]
    if len(rows) < 2:
        return []
    who, action = rows[0], rows[1]
    out = []
    for c in range(start, min(len(who), len(action), len(header))):
        if c > start and who[c] is who[c - 1]:
            continue
        if action[c]["text"].split("\n")[0].lower() not in RECRUIT_ACTIONS:
            continue
        ep = re.match(r"\d+", header[c]["text"])
        for name in who[c]["text"].split("\n"):
            if person := resolve(names, name):
                out.append({"name": person, "ep": int(ep.group()) if ep else None})
    return out


OVERVIEW = re.compile(r"\{\{\s*Series overview(.*?)^\}\}", re.DOTALL | re.MULTILINE | re.IGNORECASE)
OVERVIEW_LINK = re.compile(r"^\|\s*link(\d+)\s*=([^\n]*)", re.MULTILINE)
MAIN_UNDER_HEADING = re.compile(
    r"^===\s*(?:Season|Series)\s+(\d+)\b[^\n]*===\s*\n\{\{\s*main\s*\|([^}|]+)",
    re.MULTILINE | re.IGNORECASE,
)


def seasons(wikitext: str) -> dict[int, str]:
    """An edition's main article: season number to season page title.

    From the `{{Series overview}}` links, or for a number missing there, the `{{main}}`
    link under a `===Season N===` heading.
    """
    out = {int(n): t.strip() for n, t in MAIN_UNDER_HEADING.findall(wikitext)}
    if m := OVERVIEW.search(wikitext):
        for n, raw in OVERVIEW_LINK.findall(m.group(1)):
            title = re.sub(r"<!--.*?-->|\[\[|\]\]", "", raw).split("#")[0].strip()
            if title:
                out[int(n)] = title
    return dict(sorted(out.items()))


def season(wikitext: str) -> dict:
    """Everything the seeder and poller need from one revision, keyed by full contestant name."""
    cast = contestants(wikitext)
    names = aliases([p["name"] for p in cast])
    tables_ = round_tables(wikitext, names)
    exits = {p["name"]: p["finish"] for p in cast}
    for rt in tables_:
        # Where a round table airs is the banished player's Finish cell; a `3/4` column
        # label alone can't say which of the two episodes it was.
        ep = exits.get(rt["banished"] or "", {}).get("ep")
        if ep is None:
            nums = re.findall(r"\d+", rt["columns"][0]["label"])
            ep = int(nums[-1]) if nums else None
        rt["ep"] = ep
    return {
        "episodes": episodes(wikitext),
        "contestants": cast,
        "roundTables": tables_,
        "murdered": [
            {"name": p["name"], "ep": p["finish"]["ep"]}
            for p in cast
            if p["finish"]["how"] == "murdered"
        ],
        "recruited": recruits(wikitext, names),
        "winners": [p["name"] for p in cast if p["finish"]["how"] in ("winner", "winners")],
    }
