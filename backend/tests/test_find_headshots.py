import json
import re
from pathlib import Path
from unittest.mock import patch

import boto3
import cv2
import numpy as np
import pytest
from moto import mock_aws

from scripts import faces, find_headshots
from scripts.find_headshots import (
    FREE,
    MANUAL,
    REGISTRY,
    REJECT,
    candidates,
    everyone,
    fixtures,
    is_person,
    manual,
    order,
    pick,
    titled,
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
        ("Málaga_Film_Festival_2026_-_William_Levy_-_4_(cropped).jpg", "William Levy"),
        ("Edyta_Śliwińska.jpg", "Edyta Sliwinska"),
    ],
)
def test_file_names_with_the_person_in_them(file, name):
    assert titled(file, name)


def test_file_names_without_the_person():
    assert not titled("Alan_Berstenberg.jpg", "Alan Bersten")
    assert not titled("Rumba_2005_nationals_champ_latin.jpg", "Alan Bersten")


ME = "Q1"


def test_p18_comes_first_and_needs_no_depicts():
    shows = {"Mine.jpg": set(), "Other.jpg": {ME}}
    assert order(ME, "Mine.jpg", ["Mine.jpg", "Other.jpg"], shows, ["X"]) == [
        "Mine.jpg",
        "Other.jpg",
    ]


def test_lead_image_and_search_hits_count_only_when_they_depict_the_person():
    shows = {"Lead.jpg": {"Q2"}, "Category.jpg": set(), "Depicts.jpg": {ME}}
    files = ["Lead.jpg", "Category.jpg", "Depicts.jpg"]
    assert order(ME, None, files, shows, ["X"]) == ["Depicts.jpg"]


def test_solo_and_named_files_are_tried_before_group_ones():
    shows = {
        "Gala_2019.jpg": {ME, "Q2"},
        "Gala_2020.jpg": {ME},
        "Jane_Doe_and_John_Roe.jpg": {ME, "Q2"},
        "Jane_Doe_2021.jpg": {ME},
    }
    assert order(ME, None, list(shows), shows, ["Jane Doe"]) == [
        "Jane_Doe_2021.jpg",
        "Gala_2020.jpg",
        "Jane_Doe_and_John_Roe.jpg",
        "Gala_2019.jpg",
    ]


def free(sha1: str = "abc") -> dict:
    return {**info(), "sha1": sha1}


def test_a_photo_with_no_face_is_skipped_for_the_next():
    infos = {"Back.jpg": free("1"), "Face.jpg": free("2")}
    crops = {"Back.jpg": None, "Face.jpg": b"webp"}
    with (
        patch.object(faces, "fetch", side_effect=lambda f: f),
        patch.object(faces, "crop", side_effect=crops.get),
    ):
        shot = pick("Jane Doe", ["Back.jpg", "Face.jpg"], infos)
        assert shot["file"] == "Face.jpg"
        assert shot["image"] == faces.key("Jane Doe", "2")
        assert pick("Jane Doe", ["Back.jpg"], infos) is None


def test_free_licenses_only():
    assert all(FREE.match(x) for x in ["CC BY 2.0", "CC BY-SA 4.0", "CC0", "Public domain"])
    assert not any(FREE.match(x) for x in ["CC BY-ND 2.0", "CC BY-NC 2.0", "Fair use", ""])


def test_network_photos_signatures_and_graves_are_not_used():
    assert usable("A.jpg", info("Alan Bersten at an event"))
    assert not usable("A.jpg", info(artist="Disney | ABC Television Group"))
    assert not usable("A.jpg", info(artist="MCA Records", license_="Public domain"))
    assert not usable("Signature_of_Kelly_Monaco.png", info())
    assert not usable("A.jpg", info("Grave of Suzanne Somers"))
    assert usable("TomBergeronApr09.jpg", info())
    assert not usable("A.jpg", info(license_="CC BY-NC 2.0"))


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
    images = [shot["image"] for shot in REG.values() if shot]
    assert len(images) == len(set(images))
    for name, shot in REG.items():
        if shot is None:
            continue
        keys = {"file", "image", "author", "license", "sourceUrl"}
        assert set(shot) == keys | ({"box"} if name in MANUAL else set()), name
        assert shot["author"] and FREE.match(shot["license"]), name
        assert shot["sourceUrl"].startswith("https://commons.wikimedia.org/wiki/File:"), name
        assert re.fullmatch(r"[a-z0-9-]+-[0-9a-f]{10}\.webp", shot["image"]), name


FACE = (Path(__file__).parent / "fixtures" / "aldrin.jpg").read_bytes()


def decode(data: bytes) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def encode(img: np.ndarray) -> bytes:
    return cv2.imencode(".jpg", img)[1].tobytes()


def test_a_portrait_crops_to_a_square_around_the_face():
    out = decode(faces.crop(FACE))
    assert out.shape == (faces.SIZE, faces.SIZE, 3)
    assert len(faces.faces(out)) == 1


def test_no_crop_without_one_clear_face():
    img = decode(FACE)
    assert faces.crop(encode(np.full_like(img, 128))) is None
    assert faces.crop(encode(np.hstack([img, img]))) is None
    assert faces.crop(encode(cv2.resize(img, (120, 150)))) is None
    assert faces.crop(b"not an image") is None


def test_keys_change_with_the_photo():
    assert faces.key("Edyta Śliwińska", "a").startswith("edyta-sliwinska-")
    assert faces.key("Jane Doe", "a") != faces.key("Jane Doe", "b")


def test_upload_crops_each_image_once_and_skips_what_the_bucket_has(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    with mock_aws():
        s3 = boto3.client("s3")
        s3.create_bucket(Bucket="site")
        s3.put_object(Bucket="site", Key="headshots/old-1.webp", Body=b"old")
        old = {"file": "Old.jpg", "image": "old-1.webp"}
        new = {"file": "New.jpg", "image": "new-2.webp"}
        with patch.object(faces, "fetch", return_value=FACE) as fetch:
            upload([old, new, new], "site", dry_run=False)
        fetch.assert_called_once_with("New.jpg")
        assert s3.get_object(Bucket="site", Key="headshots/old-1.webp")["Body"].read() == b"old"
        put = s3.get_object(Bucket="site", Key="headshots/new-2.webp")
        assert put["ContentType"] == "image/webp"
        assert decode(put["Body"].read()).shape == (faces.SIZE, faces.SIZE, 3)


def test_upload_fails_naming_a_photo_with_no_face(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    with mock_aws():
        boto3.client("s3").create_bucket(Bucket="site")
        shots = [{"file": "Back.jpg", "image": "back-1.webp"}]
        with (
            patch.object(faces, "fetch", return_value=b"not an image"),
            pytest.raises(SystemExit, match="Back.jpg"),
        ):
            upload(shots, "site", dry_run=False)


def test_a_rejected_file_is_never_picked():
    file = next(iter(REJECT))
    with patch.object(faces, "fetch", return_value=FACE):
        assert pick("Jane Doe", [file], {file: free()}) is None


def test_manual_picks_skip_the_face_check_but_not_the_license():
    name, (file, box) = next(iter(MANUAL.items()))
    blank = encode(np.full((600, 600, 3), 128, np.uint8))
    with (
        patch.object(find_headshots, "file_info", return_value={file: free("9")}),
        patch.object(faces, "fetch", return_value=blank),
    ):
        shot = manual(name)
        assert shot["box"] == list(box)
        assert shot["image"] == faces.key(name, "9", box) != faces.key(name, "9")
    nc = {
        **free(),
        "extmetadata": {**free()["extmetadata"], "LicenseShortName": {"value": "CC BY-NC 2.0"}},
    }
    with (
        patch.object(find_headshots, "file_info", return_value={file: nc}),
        pytest.raises(ValueError, match="not free"),
    ):
        manual(name)


def test_a_hand_box_crops_to_a_square_and_must_fit():
    out = decode(faces.crop_box(FACE, (10, 20, 200)))
    assert out.shape == (faces.SIZE, faces.SIZE, 3)
    with pytest.raises(ValueError, match="outside"):
        faces.crop_box(FACE, (300, 0, 200))


def test_upload_crops_a_manual_shot_by_its_box_without_a_face(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    blank = encode(np.full((300, 300, 3), 128, np.uint8))
    with mock_aws():
        s3 = boto3.client("s3")
        s3.create_bucket(Bucket="site")
        shot = {"file": "Sign.jpg", "image": "judge-1.webp", "box": [0, 0, 100]}
        with patch.object(faces, "fetch", return_value=blank):
            upload([shot], "site", dry_run=False)
        body = s3.get_object(Bucket="site", Key="headshots/judge-1.webp")["Body"].read()
        assert decode(body).shape == (faces.SIZE, faces.SIZE, 3)
