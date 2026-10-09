"""
Every email: one shared layout, themed per show (common/email_theme.py), with
an HTML and a plain-text part.

Table layout and inline styles because Gmail and Outlook drop most CSS. The
designs are dark already, and `color-scheme: dark` keeps clients that honor it
from inverting them. Every value from a person (names, group names) is escaped
here; callers pass plain strings.

Nothing here decides what a reader may see. The digest's spoiler rules live in
common/email_digest.py, which hands this module only what the reader has revealed.
"""

from __future__ import annotations

import html
from typing import NamedTuple

NOT_AFFILIATED = {
    "dwts": "Not affiliated with Dancing with the Stars, ABC, Disney or the show's producers.",
    "traitors": "Not affiliated with The Traitors, BBC, NBC or Peacock.",
}


class Email(NamedTuple):
    subject: str
    preheader: str
    html: str
    text: str


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def _button(t: dict, label: str, url: str) -> str:
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px">
<tr><td bgcolor="{t["button"]}" style="border-radius:8px;background:{t["button"]}">
<a href="{esc(url)}" style="display:inline-block;padding:14px 26px;font:700 16px/1 {t["body"]};color:{t["buttonText"]};text-decoration:none;border-radius:8px">{esc(label)}</a>
</td></tr></table>"""


def para(t: dict, text: str, muted: bool = False) -> str:
    color = t["muted"] if muted else t["text"]
    return f'<p style="margin:0 0 14px;font:16px/1.55 {t["body"]};color:{color}">{esc(text)}</p>'


def stats(t: dict, cells: list[tuple[str, str]]) -> str:
    """A row of big numbers with a label under each."""
    width = 100 // max(len(cells), 1)
    tds = "".join(
        f"""<td width="{width}%" align="center" valign="top" style="padding:14px 6px">
<div style="font:24px/1.1 {t["display"]};color:{t["accent"]}">{esc(value)}</div>
<div style="margin-top:6px;font:12px/1.3 {t["body"]};letter-spacing:0.06em;text-transform:uppercase;color:{t["muted"]}">{esc(label)}</div>
</td>"""
        for label, value in cells
    )
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{t["panel"]}" style="background:{t["panel"]};border-radius:10px;margin:4px 0 18px">
<tr>{tds}</tr></table>"""


def move_text(move: int | None) -> str:
    if not move:
        return ""
    return f"up {move}" if move > 0 else f"down {-move}"


def standings(t: dict, title: str, rows: list[dict], note: str | None = None) -> str:
    """rows: {rank, name, value, move?, me?}. The reader's own row is picked out in the accent."""
    trs = []
    for r in rows:
        color = t["accent"] if r.get("me") else t["text"]
        weight = 700 if r.get("me") else 400
        move = move_text(r.get("move"))
        trs.append(
            f"""<tr>
<td width="36" style="padding:8px 0;font:700 14px {t["body"]};color:{t["muted"]}">{esc(r["rank"] or "-")}</td>
<td style="padding:8px 6px;font:{weight} 15px {t["body"]};color:{color}">{esc(r["name"])}{" (you)" if r.get("me") else ""}</td>
<td align="right" style="padding:8px 0;font:{weight} 15px {t["body"]};color:{color};white-space:nowrap">{esc(r["value"])}</td>
<td align="right" width="64" style="padding:8px 0 8px 8px;font:12px {t["body"]};color:{t["muted"]};white-space:nowrap">{esc(move)}</td>
</tr>"""
        )
    foot = para(t, note, muted=True) if note else ""
    return f"""<h2 style="margin:22px 0 6px;font:15px/1.3 {t["display"]};letter-spacing:0.08em;text-transform:{t["displayCase"]};color:{t["accentSoft"]}">{esc(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {t["rule"]}">
{"".join(trs)}</table>{foot}"""


def layout(
    t: dict,
    *,
    preheader: str,
    heading: str,
    body: str,
    cta: tuple[str, str],
    reason: str,
    unsubscribe: list[tuple[str, str]],
) -> str:
    """`unsubscribe` is (label, url) pairs for the footer: this type, then the whole show."""
    site = t["site"]
    links = " &middot; ".join(
        f'<a href="{esc(url)}" style="color:{t["muted"]};text-decoration:underline">{esc(label)}</a>'
        for label, url in [*unsubscribe, ("Email settings", f"{site}{t['settings']}")]
    )
    host = site.removeprefix("https://")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{esc(heading)}</title>
<style>
:root {{ color-scheme: dark; supported-color-schemes: dark; }}
@media (max-width: 620px) {{ .wrap {{ padding: 20px 16px !important; }} }}
</style>
</head>
<body style="margin:0;padding:0;background:{t["page"]}" bgcolor="{t["page"]}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{t["page"]}">{esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{t["page"]}" style="background:{t["page"]}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" style="padding:6px 0 18px">
<a href="{esc(site)}/" style="text-decoration:none">
<img src="{esc(site)}{t["mark"]}" width="56" height="56" alt="" style="display:block;margin:0 auto 10px;border:0;border-radius:14px">
<div style="font:20px/1.1 {t["display"]};letter-spacing:0.16em;text-transform:{t["displayCase"]};color:{t["accent"]}">{esc(t["name"])}</div>
<div style="margin-top:6px;font:12px/1 {t["body"]};letter-spacing:0.22em;text-transform:uppercase;color:{t["muted"]}">Armchair Judge</div>
</a>
</td></tr>
<tr><td class="wrap" bgcolor="{t["card"]}" style="background:{t["card"]};border-top:3px solid {t["accent"]};border-radius:14px;padding:28px 28px 24px">
<h1 style="margin:0 0 16px;font:26px/1.2 {t["display"]};color:{t["text"]}">{esc(heading)}</h1>
{body}
{_button(t, *cta)}
</td></tr>
<tr><td style="padding:22px 8px 8px;font:12px/1.6 {t["body"]};color:{t["muted"]}">
<p style="margin:0 0 8px">{esc(reason)}</p>
<p style="margin:0 0 8px">{links}</p>
<p style="margin:0 0 8px">Replies to this address aren't read. To reach us, open <a href="{esc(site)}/" style="color:{t["muted"]}">{esc(host)}</a>.</p>
<p style="margin:0">{esc(NOT_AFFILIATED[t["show"]])}</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>"""


def text_part(
    t: dict, heading: str, lines: list[str], cta: tuple[str, str], reason: str, unsubscribe: list
) -> str:
    out = [f"{t['name']} | Armchair Judge", "", heading, "", *lines, "", f"{cta[0]}: {cta[1]}", ""]
    out += ["--", reason]
    out += [f"{label}: {url}" for label, url in unsubscribe]
    out += [f"Email settings: {t['site']}{t['settings']}"]
    out += ["Replies to this address aren't read.", NOT_AFFILIATED[t["show"]]]
    return "\n".join(out) + "\n"


def compose(
    t: dict,
    *,
    subject: str,
    preheader: str,
    heading: str,
    blocks: list[str],
    lines: list[str],
    cta: tuple[str, str],
    reason: str,
    unsubscribe: list[tuple[str, str]],
) -> Email:
    """`blocks` is the HTML body, `lines` the same content as plain text."""
    page = layout(
        t,
        preheader=preheader,
        heading=heading,
        body="\n".join(blocks),
        cta=cta,
        reason=reason,
        unsubscribe=unsubscribe,
    )
    return Email(subject, preheader, page, text_part(t, heading, lines, cta, reason, unsubscribe))


# --- The emails. Each takes the theme, its context and the footer's unsubscribe links. ---


def tonight(t: dict, ctx: dict, unsubscribe: list) -> Email:
    """ctx: label ("Week 4" / "Episode 6"), when ("8:00 pm ET"), verb ("score" / "pick"), url."""
    verb = ctx["verb"]
    heading = f"Tonight: {t['short']} {ctx['label']}"
    first = f"{t['name']} {ctx['label']} starts at {ctx['when']}."
    second = (
        "Score every dance as it happens, blind, then see how the judges and everyone else called it."
        if verb == "score"
        else "Lock in your picks before the episode, then see who called it."
    )
    return compose(
        t,
        subject=heading,
        preheader=f"{first} Get ready to {verb}.",
        heading=heading,
        blocks=[para(t, first), para(t, second)],
        lines=[first, second],
        cta=("Open tonight's episode", ctx["url"]),
        reason=f"You're getting this because you've played {t['name']} on Armchair Judge.",
        unsubscribe=unsubscribe,
    )


def closing(t: dict, ctx: dict, unsubscribe: list) -> Email:
    """ctx: label, days (int), answered, rateable, url."""
    days = ctx["days"]
    when = "tomorrow" if days == 1 else f"in {days} days"
    heading = f"Don't forget: {ctx['label']} locks {when}"
    left = ctx["rateable"] - ctx["answered"]
    first = (
        f"You've scored {ctx['answered']} of {ctx['rateable']} dances in {ctx['label']}. "
        f"Once it locks, the {left} you haven't scored count as missed."
    )
    return compose(
        t,
        subject=heading,
        preheader=f"{left} dance{'s' if left != 1 else ''} left to score before {ctx['label']} locks.",
        heading=heading,
        blocks=[
            para(t, first),
            stats(
                t,
                [
                    ("Scored", str(ctx["answered"])),
                    ("Left", str(left)),
                    ("Days to lock", str(days)),
                ],
            ),
        ],
        lines=[first],
        cta=(f"Finish {ctx['label']}", ctx["url"]),
        reason=f"You're getting this because you've scored {t['name']} on Armchair Judge.",
        unsubscribe=unsubscribe,
    )


def digest(t: dict, ctx: dict, unsubscribe: list) -> Email:
    """
    ctx: label, revealed (bool), url, sealed (the label of the first period the reader
    finished but keeps face down, else None), and only what the reader may see:
      you: {cells: [(label, value)], line} or None
      groups: [{name, rows, note?}]   global: {rows, note?} or None   top: [rows] or None
      through: the label the standings run through when it isn't `label`, else None
    """
    label = ctx["label"]
    subject = t["digestSubject"].format(label=label)
    blocks, lines = [], []
    if ctx["revealed"]:
        preheader = "Your numbers, your groups and the top of the table."
        heading = f"{label}: your results"
    elif ctx.get("sealed"):
        held = ctx["sealed"]
        preheader = f"Reveal {held} in the app to see how you did."
        heading = f"{label} results are in"
        what = "from it" if held == label else f"from {held} on"
        first = (
            f"You're keeping {held} face down, so nothing {what} is in this email. "
            f"Reveal {held} in the app to see your results."
        )
        blocks.append(para(t, first))
        lines.append(first)
    else:
        preheader = f"Finish {label} in the app to see how you did."
        heading = f"{label} results are in"
        first = (
            f"You haven't finished {label} yet, so nothing from it is in this email. "
            "Finish it in the app to see your numbers and where you stand."
        )
        blocks.append(para(t, first))
        lines.append(first)
    if ctx.get("through"):
        last = "revealed" if ctx.get("sealed") else "finished"
        note = f"Standings below run through {ctx['through']}, the last one you've {last}."
        blocks.append(para(t, note, muted=True))
        lines.append(note)

    you = ctx.get("you")
    if you:
        blocks.append(stats(t, you["cells"]))
        blocks.append(para(t, you["line"]))
        lines += [f"{k}: {v}" for k, v in you["cells"]] + [you["line"]]
    for g in ctx.get("groups") or []:
        blocks.append(standings(t, g["name"], g["rows"], g.get("note")))
        lines += ["", g["name"], *(_row_text(r) for r in g["rows"])]
    if ctx.get("global"):
        blocks.append(standings(t, "Everyone", ctx["global"]["rows"], ctx["global"].get("note")))
        lines += ["", "Everyone", *(_row_text(r) for r in ctx["global"]["rows"])]
    if ctx.get("top"):
        blocks.append(standings(t, f"Top of {label}", ctx["top"]))
        lines += ["", f"Top of {label}", *(_row_text(r) for r in ctx["top"])]

    return compose(
        t,
        subject=subject,
        preheader=preheader,
        heading=heading,
        blocks=blocks,
        lines=lines,
        cta=(
            f"See {label}"
            if ctx["revealed"]
            else f"Reveal {ctx['sealed']}"
            if ctx.get("sealed")
            else f"Finish {label}",
            ctx["url"],
        ),
        reason=f"You're getting this because you play {t['name']} on Armchair Judge.",
        unsubscribe=unsubscribe,
    )


def _row_text(r: dict) -> str:
    move = move_text(r.get("move"))
    me = " (you)" if r.get("me") else ""
    return f"{r['rank'] or '-'}. {r['name']}{me}  {r['value']}" + (f"  {move}" if move else "")


def group_invite(t: dict, ctx: dict, unsubscribe: list) -> Email:
    """ctx: inviter, group, url."""
    heading = f"{ctx['inviter']} invited you to {ctx['group']}"
    first = (
        f"{ctx['inviter']} wants you in their group, {ctx['group']}, on Armchair Judge. "
        "Groups get their own standings for every show."
    )
    return compose(
        t,
        subject=heading,
        preheader="Accept or decline in the app.",
        heading=heading,
        blocks=[para(t, first)],
        lines=[first],
        cta=("Answer the invite", ctx["url"]),
        reason="You're getting this because someone invited you on Armchair Judge.",
        unsubscribe=unsubscribe,
    )


def friend_request(t: dict, ctx: dict, unsubscribe: list) -> Email:
    """ctx: requester, url."""
    heading = f"{ctx['requester']} wants to be friends"
    first = (
        f"{ctx['requester']} sent you a friend request on Armchair Judge. "
        "Friends see each other on the friends leaderboard once they've played the same episode."
    )
    return compose(
        t,
        subject=heading,
        preheader="Accept or decline in the app.",
        heading=heading,
        blocks=[para(t, first)],
        lines=[first],
        cta=("See the request", ctx["url"]),
        reason="You're getting this because someone sent you a friend request on Armchair Judge.",
        unsubscribe=unsubscribe,
    )


def group_activated(t: dict, ctx: dict, unsubscribe: list) -> Email:
    """ctx: actor, group, url."""
    heading = f"{ctx['actor']} started {t['short']} for {ctx['group']}"
    first = (
        f"{ctx['actor']} is playing {t['name']} with {ctx['group']} on Armchair Judge. "
        "Join in and the group gets its own standings every week."
    )
    return compose(
        t,
        subject=heading,
        preheader=f"Join {ctx['group']} on {t['short']}.",
        heading=heading,
        blocks=[para(t, first)],
        lines=[first],
        cta=(f"Join on {t['short']}", ctx["url"]),
        reason=f"You're getting this because you're in {ctx['group']} on Armchair Judge.",
        unsubscribe=unsubscribe,
    )


RENDER = {
    "tonight": tonight,
    "closing": closing,
    "digest": digest,
    "group_invite": group_invite,
    "friend_request": friend_request,
    "group_activated": group_activated,
}
