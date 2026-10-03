"""A recap written from an episode's confirmed results, for episodes no wiki summarises.

US Wikipedia pages carry no episode summaries and the US Fandom wiki has no episode
pages, so without this almost every US episode would have no recap. Pure; callers pass
what `traitors_gate.shown` returns, so only confirmed results are ever told.
"""

from __future__ import annotations


def names(ids: list[str], who: dict[str, str]) -> str:
    named = [who.get(i, i) for i in ids]
    return named[0] if len(named) == 1 else ", ".join(named[:-1]) + " and " + named[-1]


def written(results: dict[str, dict | None], who: dict[str, str]) -> dict | None:
    """`{text, source: "results", sourceUrl: None}` from the MURDER, RT and RECRUIT results, or None."""
    lines = []
    murder = results.get("MURDER")
    if murder is not None:
        victims = murder.get("victims") or []
        if victims:
            verb = "was" if len(victims) == 1 else "were"
            lines.append(f"At breakfast, {names(victims, who)} {verb} found murdered.")
        else:
            lines.append("Everyone made it to breakfast: no murder.")
    rt = results.get("RT")
    if rt is not None and rt.get("banished"):
        votes = rt.get("firstVote") or {}
        total = sum(int(v) for v in votes.values())
        got = int(votes.get(rt["banished"], 0))
        line = f"At the round table, {who.get(rt['banished'], rt['banished'])} was banished"
        if total:
            line += f" with {got} of {total} votes"
        lines.append(
            line + (f" and revealed they were a {rt['faction']}." if rt.get("faction") else ".")
        )
    recruit = results.get("RECRUIT")
    if recruit and recruit.get("recruits"):
        lines.append(
            f"That night the Traitors went after a new recruit: {names(recruit['recruits'], who)}."
        )
    if not lines:
        return None
    return {"text": " ".join(lines), "source": "results", "sourceUrl": None}
