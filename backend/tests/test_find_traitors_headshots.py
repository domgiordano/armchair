import io
import json
import urllib.parse
import urllib.request

import boto3
import pytest

from scripts import faces
from scripts import find_traitors_headshots as finder


@pytest.fixture
def registry(tmp_path, monkeypatch):
    path = tmp_path / "traitors-headshots.json"
    monkeypatch.setattr(finder, "REGISTRY", path)
    return path


def test_approve_uploads_the_pick_and_records_it(aws, tmp_path, registry):
    boto3.client("s3").create_bucket(Bucket="site")
    out = tmp_path / "run"
    (out / "kim-daily").mkdir(parents=True)
    (out / "kim-daily" / "1.webp").write_bytes(b"crop")
    cands = [
        {"n": 0, "image": "https://a/x.jpg", "page": "https://a", "sha1": "aa"},
        {"n": 1, "image": "https://b/y.jpg", "page": "https://b/page", "sha1": "bb"},
    ]
    (out / "candidates.json").write_text(json.dumps({"Kim Daily": cands}))

    finder.approve(out, {"Kim Daily": 1}, "site", dry_run=False)

    entry = json.loads(registry.read_text())["Kim Daily"]
    assert entry["sourceUrl"] == "https://b/page"
    assert entry["image"].startswith("kim-daily-")
    body = (
        boto3.client("s3")
        .get_object(Bucket="site", Key=f"headshots/{entry['image']}")["Body"]
        .read()
    )
    assert body == b"crop"


UK = "https://thetraitorsuk.fandom.com/api.php"
THUMB = "https://static.wikia.nocookie.net/x/KingKenny.webp/scale-to-width-down/960"


def fake_urlopen(monkeypatch, routes: dict):
    """urlopen answering from `routes`: {(url prefix, param that must be in the query): body}."""

    def urlopen(req, timeout=None):
        url = urllib.parse.unquote_plus(req.full_url)
        for (prefix, needle), body in routes.items():
            if url.startswith(prefix) and needle in url:
                return io.BytesIO(body if isinstance(body, bytes) else json.dumps(body).encode())
        raise AssertionError(f"unexpected fetch {url}")

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)


def file_info(name: str) -> dict:
    info = {
        "thumburl": THUMB,
        "url": "https://static.wikia.nocookie.net/x/KingKenny.webp",
        "descriptionurl": f"https://thetraitorsuk.fandom.com/wiki/File:{name}",
        "sha1": "abc",
    }
    return {"query": {"pages": [{"title": f"File:{name}", "imageinfo": [info]}]}}


@pytest.fixture
def face(monkeypatch):
    monkeypatch.setattr(faces, "crop", lambda data: b"crop" if data == b"photo" else None)


def wiki_page(title: str, image: str | None = None) -> dict:
    page = {"title": title, "revisions": [{"slots": {"main": {"content": "x"}}}]}
    return page | ({"pageimage": image} if image else {})


def test_fandom_crops_the_main_image_of_the_players_page(monkeypatch, face):
    page = wiki_page("King Kenny", "KingKenny.webp")
    fake_urlopen(
        monkeypatch,
        {
            (UK, "titles=King Kenny"): {"query": {"pages": [page]}},
            (UK, "titles=File:KingKenny.webp"): file_info("KingKenny.webp"),
            (THUMB, ""): b"photo",
        },
    )

    crop, shot = finder.fandom("tukc", "King Kenny")

    assert crop == b"crop"
    assert shot == {
        "image": faces.key("King Kenny", "abc"),
        "sourceUrl": "https://thetraitorsuk.fandom.com/wiki/File:KingKenny.webp",
        "source": "fandom",
    }


def test_fandom_search_only_takes_a_page_titled_with_the_name(monkeypatch, face):
    hits = [{"title": "Series 2 (Celebrity)"}, {"title": "Ross Kemp (Celebrity)"}]
    fake_urlopen(
        monkeypatch,
        {
            (UK, "titles=Ross Kemp (Celebrity)"): {
                "query": {"pages": [wiki_page("Ross Kemp (Celebrity)", "RossKemp.webp")]}
            },
            (UK, "titles=Ross Kemp"): {
                "query": {"pages": [{"title": "Ross Kemp", "missing": True}]}
            },
            (UK, "srsearch=Ross Kemp"): {"query": {"search": hits}},
            (UK, "titles=File:RossKemp.webp"): file_info("RossKemp.webp"),
            (THUMB, ""): b"photo",
        },
    )
    _, shot = finder.fandom("tukc", "Ross Kemp")
    assert shot["sourceUrl"] == "https://thetraitorsuk.fandom.com/wiki/File:RossKemp.webp"


def test_fandom_skips_a_photo_without_one_clear_face(monkeypatch, face):
    page = wiki_page("King Kenny", "KingKenny.webp")
    fake_urlopen(
        monkeypatch,
        {
            (UK, "titles=King Kenny"): {"query": {"pages": [page]}},
            (UK, "titles=File:KingKenny.webp"): file_info("KingKenny.webp"),
            (THUMB, ""): b"a crowd",
        },
    )
    assert finder.fandom("tukc", "King Kenny") is None


def test_fandom_has_no_page_for_the_name(monkeypatch):
    fake_urlopen(
        monkeypatch,
        {
            (UK, "titles=Sharon Rooney"): {
                "query": {"pages": [{"title": "Sharon Rooney", "missing": True}]}
            },
            (UK, "srsearch=Sharon Rooney"): {"batchcomplete": True},
            (UK, "srsearch=Rooney"): {"query": {"search": [{"title": "Wayne Rooney"}]}},
        },
    )
    assert finder.fandom("tukc", "Sharon Rooney") is None


def test_resolve_takes_commons_first_and_brave_only_with_a_key(monkeypatch):
    shot = {"image": "a.webp", "sourceUrl": "https://c", "source": "commons"}
    monkeypatch.setattr(finder, "commons", lambda show, title, names: {"Ann": (b"c", shot)})
    monkeypatch.setattr(finder, "fandom", lambda show, name: None)
    monkeypatch.setattr(finder.official, "cast", lambda *a: {})
    monkeypatch.setattr(finder, "brave", lambda *a: pytest.fail("searched without a key"))
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)

    assert finder.resolve("tus", 5, "T", ["Ann", "Bob"]) == {"Ann": (b"c", shot)}


def test_resolve_falls_back_to_the_networks_cast_page(monkeypatch, face):
    page = "https://www.bbc.co.uk/mediacentre/mediapacks/the-traitors-series-4-contestants"
    asked = []

    def cast(show, number, names, running):
        asked.append((show, number))
        return {"Bob": {"image": "https://ichef/bob.jpg", "sourceUrl": page}}

    monkeypatch.setattr(finder, "commons", lambda show, title, names: {})
    monkeypatch.setattr(finder, "fandom", lambda show, name: None)
    monkeypatch.setattr(finder.official, "cast", cast)
    monkeypatch.setattr(
        finder, "download", lambda url: b"photo" if url.endswith("bob.jpg") else None
    )
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)

    found = finder.resolve("tuk", 4, "T", ["Ann", "Bob"])

    assert list(found) == ["Bob"]
    crop, shot = found["Bob"]
    assert crop == b"crop"
    assert (shot["source"], shot["sourceUrl"]) == ("official", page)
    # One fetch of the page for the season, however many players miss.
    assert asked == [("tuk", 4)]


SEASON_PK = "SEASON#tus#5"


def test_auto_uploads_and_writes_onto_player_and_person(aws, registry, monkeypatch):
    from tests.conftest import CATALOG_TABLE

    boto3.client("s3").create_bucket(Bucket="site")
    catalog = aws.Table(CATALOG_TABLE)
    had = {"image": "had.webp", "sourceUrl": "https://h", "source": "fandom"}
    for item in [
        {"pk": SEASON_PK, "sk": "META", "pageid": 7},
        {"pk": SEASON_PK, "sk": "PLAYER#kim-daily", "name": "Kim Daily"},
        {"pk": SEASON_PK, "sk": "PLAYER#joe-vanella", "name": "Joe Vanella"},
        {"pk": SEASON_PK, "sk": "PLAYER#abby-lee", "name": "Abby Lee", "headshot": had},
        {"pk": "PERSON#tus#kim-daily", "sk": "META", "name": "Kim Daily"},
        {"pk": "PEOPLE#tus", "sk": "PERSON#kim-daily", "name": "Kim Daily"},
    ]:
        catalog.put_item(Item=item)
    cast = [{"name": n} for n in ("Kim Daily", "Joe Vanella", "Abby Lee")]
    monkeypatch.setattr(finder, "latest", lambda pageid: {"title": "NB", "content": str(pageid)})
    monkeypatch.setattr(finder, "season", lambda content: {"contestants": cast})
    asked = []
    shot = {"image": "kim-daily-x.webp", "sourceUrl": "https://f/File:K", "source": "fandom"}

    def resolve(show, number, title, names):
        asked.extend(names)
        return {"Kim Daily": (b"crop", shot)}

    monkeypatch.setattr(finder, "resolve", resolve)

    finder.auto("tus", [5], "site", dry_run=False)

    assert asked == ["Kim Daily", "Joe Vanella"]
    body = boto3.client("s3").get_object(Bucket="site", Key="headshots/kim-daily-x.webp")
    assert body["Body"].read() == b"crop"
    assert body["CacheControl"] == "public, max-age=31536000, immutable"

    def get(pk, sk):
        return catalog.get_item(Key={"pk": pk, "sk": sk})["Item"]

    assert get(SEASON_PK, "PLAYER#kim-daily")["headshot"] == shot
    assert get("PERSON#tus#kim-daily", "META")["headshot"] == shot
    assert get("PEOPLE#tus", "PERSON#kim-daily")["headshot"] == "kim-daily-x.webp"
    assert "headshot" not in get(SEASON_PK, "PLAYER#joe-vanella")
    assert get(SEASON_PK, "PLAYER#abby-lee")["headshot"] == had
    assert catalog.get_item(Key={"pk": "PERSON#tus#joe-vanella", "sk": "META"}).get("Item") is None
    assert json.loads(registry.read_text()) == {"Kim Daily": shot}


def test_auto_dry_run_with_a_pageid_touches_nothing(registry, monkeypatch):
    monkeypatch.setattr(finder, "latest", lambda pageid: {"title": "NB", "content": ""})
    monkeypatch.setattr(finder, "season", lambda content: {"contestants": [{"name": "Kim"}]})
    monkeypatch.setattr(finder, "resolve", lambda show, number, title, names: {"Kim": (b"c", {})})
    monkeypatch.setattr(boto3, "resource", None)
    monkeypatch.setattr(boto3, "client", None)

    finder.auto("tus", [5], "site", dry_run=True, pageid=83493607)

    assert not registry.exists()


def test_auto_needs_a_seeded_season_or_a_pageid(aws, registry):
    with pytest.raises(SystemExit, match="not in the catalog"):
        finder.auto("tus", [9], "site", dry_run=False)


def test_contact_sheet_lists_every_name(tmp_path):
    finder.sheet(tmp_path, {"Kim Daily": [{"n": 0}], "Joe Vanella": []})
    page = (tmp_path / "contact.html").read_text()
    assert 'src="kim-daily/0.webp"' in page
    assert "Joe Vanella</h2><p>none found" in page
