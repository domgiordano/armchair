import io
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

import pytest

from lambdas.cron_poll_wiki import handler as poller

FIXTURES = Path(__file__).parents[2] / "fixtures"
GOLDEN = {
    c["name"]: c["expected"]
    for c in json.loads((FIXTURES / "wiki-golden.json").read_text())["cases"]
}


def page(fixture: str) -> str:
    return (FIXTURES / "wiki" / fixture).read_text()


def serve(monkeypatch, content: str, revid: int) -> list:
    """Stubs urlopen with the API's formatversion=2 response around a page's wikitext."""
    body = {
        "query": {
            "pages": [
                {
                    "title": poller.PAGE,
                    "revisions": [
                        {
                            "revid": revid,
                            "timestamp": "2026-09-30T15:03:34Z",
                            "slots": {"main": {"content": content}},
                        }
                    ],
                }
            ]
        }
    }
    calls = []

    def urlopen(req, timeout):
        calls.append(req)
        return io.BytesIO(json.dumps(body).encode())

    monkeypatch.setattr(poller, "urlopen", urlopen)
    return calls


def logged(capsys) -> dict:
    lines = capsys.readouterr().out.splitlines()
    assert len(lines) == 1
    return json.loads(lines[0])


def test_logs_the_pre_show_week_from_one_request(monkeypatch, capsys):
    calls = serve(monkeypatch, page("s35-1377681547.wikitext"), 1377681547)

    assert poller.handler({}, None) == {"revid": 1377681547, "week": 4}

    assert len(calls) == 1
    params = parse_qs(urlsplit(calls[0].full_url).query)
    assert params["titles"] == [poller.PAGE]
    assert params["rvprop"] == ["ids|timestamp|content"]
    assert calls[0].get_header("User-agent") == poller.USER_AGENT

    line = logged(capsys)
    assert line["revid"] == 1377681547
    assert line["week"] == GOLDEN["S35 week 4 pre-show alphabetical table, empty cells"]


def test_logs_a_half_scored_week_mid_show(monkeypatch, capsys):
    serve(monkeypatch, page("s35-1377571301-revert.wikitext"), 1377571301)

    poller.handler({}, None)

    week = logged(capsys)["week"]
    assert week == GOLDEN["S35 week 3 revert of the vandal edit, mid-show"]
    assert [p["judges"] for p in week["performances"]].count(None) == 4


def test_logs_rejected_rows_with_the_check_reason(monkeypatch, capsys):
    text = page("s35-1377681547.wikitext")
    empty = '! scope="row" | Tyler & Sharna\n|\n'
    at = text.rindex(empty)  # week 4's pre-show row
    bad = '! scope="row" | Tyler & Sharna\n| 25 (8, 8, 8)\n'
    serve(monkeypatch, text[:at] + bad + text[at + len(empty) :], 1)

    poller.handler({}, None)

    week = logged(capsys)["week"]
    assert week["week"] == 4
    assert week["rejected"] == [
        {"night": 1, "row": "Tyler & Sharna", "reason": "judge values sum to 24, total is 25"}
    ]


def test_a_failed_request_fails_the_tick(monkeypatch, capsys):
    def urlopen(req, timeout):
        raise HTTPError(req.full_url, 503, "Service Unavailable", {}, None)

    monkeypatch.setattr(poller, "urlopen", urlopen)

    with pytest.raises(HTTPError):
        poller.handler({}, None)
    assert capsys.readouterr().out == ""
