import json
from email.message import Message
from io import BytesIO
from unittest.mock import patch

import boto3
import pytest
from moto import mock_aws

from scripts.find_headshots import (
    FREE,
    REGISTRY,
    candidates,
    everyone,
    fixtures,
    is_person,
    named,
    solo,
    usable,
)
from scripts.seed_season import upload

REG = json.loads(REGISTRY.read_text())


def info(desc: str = "", artist: str = "Jane Doe", license_: str = "CC BY 2.0") -> dict:
    meta = {"ImageDescription": desc, "Artist": artist, "LicenseShortName": license_}
    return {
        "mime": "image/jpeg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:X.jpg",
        "extmetadata": {k: {"value": v} for k, v in meta.items()},
    }


def item(label: str, *aliases: str, human: bool = True, lang: str = "en") -> dict:
    kind = {"mainsnak": {"datavalue": {"value": {"id": "Q5" if human else "Q15416"}}}}
    return {
        "claims": {"P31": [kind]},
        "labels": {lang: {"value": label}},
        "aliases": {lang: [{"value": a} for a in aliases]},
    }


@pytest.mark.parametrize(
    ("file", "name"),
    [
        ("Witney_Carson_2019_by_Glenn_Francis_(cropped).jpg", "Witney Carson"),
        ("Alan_Bersten_2019_(cropped).jpg", "Alan Bersten"),
        ("Jan_Ravnik_at_Tribeca_Film_Festival_2026-1.jpg", "Jan Ravnik"),
        ("Edyta_Śliwińska.jpg", "Edyta Śliwińska"),
    ],
)
def test_file_names_that_are_the_person(file, name):
    assert named(file, name)


@pytest.mark.parametrize(
    "file",
    [
        "Alan_Bersten_and_Hannah_Brown.jpg",
        "Rumba_2005_nationals_champ_latin.jpg",
        "Alan_Berstenberg.jpg",
    ],
)
def test_file_names_that_are_not_just_the_person(file):
    assert not named(file, "Alan Bersten")


def test_free_licenses_only():
    assert all(FREE.match(x) for x in ["CC BY 2.0", "CC BY-SA 4.0", "CC0", "Public domain"])
    assert not any(FREE.match(x) for x in ["CC BY-ND 2.0", "CC BY-NC 2.0", "Fair use", ""])


def test_network_photos_signatures_and_graves_are_not_used():
    assert usable("A.jpg", info("Alan Bersten at an event"))
    assert not usable("A.jpg", info(artist="Disney | ABC Television Group"))
    assert not usable("A.jpg", info(artist="MCA Records", license_="Public domain"))
    assert not usable("Signature_of_Kelly_Monaco.png", info())
    assert not usable("A.jpg", info("Grave of Suzanne Somers"))
    assert not usable("A.jpg", info(license_="CC BY-NC 2.0"))


def test_a_description_naming_someone_else_is_not_solo():
    assert solo(("Chelsie Hightower",), info("Chelsie Hightower at the premiere for Earth"))
    assert not solo(("Chelsie Hightower",), info("Chelsie Hightower and Mark Ballas"))
    assert not solo(("Chelsie Hightower",), info("Mark Ballas with Chelsie Hightower"))


def test_an_article_counts_only_for_a_human_labelled_with_the_name():
    assert is_person(item("Valentin Chmerkovskiy", "Val Chmerkovskiy"), "Val Chmerkovskiy")
    assert is_person(item("Ricky Martin", lang="mul"), "Ricky Martin")
    assert not is_person(item("Dancing with the Stars", human=False), "Charlotte Jørgensen")


def test_candidates_follow_redirects_and_skip_disambiguation():
    rows = [
        {"title": "Jonathan Roberts (dancer)", "pageprops": {"wikibase_item": "Q1"}},
        {"title": "Kym Herjavec", "pageprops": {"wikibase_item": "Q2"}},
        {"title": "Mark Ballas (disambiguation)", "pageprops": {"disambiguation": ""}},
        {"redirect": {"from": "Kym Johnson", "to": "Kym Herjavec"}},
    ]
    found = candidates(rows, {"Jonathan Roberts", "Kym Johnson", "Mark Ballas"})
    assert {n: [p["title"] for p in ps] for n, ps in found.items()} == {
        "Jonathan Roberts": ["Jonathan Roberts (dancer)"],
        "Kym Johnson": ["Kym Herjavec"],
    }


def test_every_fixture_headshot_is_the_registry_entry():
    for path in fixtures():
        for p in everyone(json.loads(path.read_text())):
            assert p["headshot"] == REG.get(p["name"]), (path.stem, p["name"])


def test_every_registry_headshot_is_credited_and_free():
    for name, shot in REG.items():
        if shot is None:
            continue
        assert set(shot) == {"file", "author", "license", "sourceUrl"}, name
        assert shot["author"] and FREE.match(shot["license"]), name
        assert shot["sourceUrl"].startswith("https://commons.wikimedia.org/wiki/File:"), name


class Resp(BytesIO):
    def __init__(self) -> None:
        super().__init__(b"jpeg")
        self.headers = Message()
        self.headers["Content-Type"] = "image/jpeg"


def test_upload_copies_each_file_once_and_skips_what_the_bucket_has(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    with mock_aws():
        s3 = boto3.client("s3")
        s3.create_bucket(Bucket="site")
        s3.put_object(Bucket="site", Key="headshots/Old.jpg", Body=b"old")
        shots = [{"file": "Old.jpg"}, {"file": "New.jpg"}, {"file": "New.jpg"}]
        with patch("urllib.request.urlopen", return_value=Resp()) as fetch:
            upload(shots, "site", dry_run=False)
        assert fetch.call_count == 1
        assert "Special:FilePath/New.jpg" in fetch.call_args.args[0].full_url
        assert s3.get_object(Bucket="site", Key="headshots/Old.jpg")["Body"].read() == b"old"
        assert s3.get_object(Bucket="site", Key="headshots/New.jpg")["Body"].read() == b"jpeg"
