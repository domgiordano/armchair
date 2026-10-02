import json

import boto3
import pytest

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


def test_contact_sheet_lists_every_name(tmp_path):
    finder.sheet(tmp_path, {"Kim Daily": [{"n": 0}], "Joe Vanella": []})
    page = (tmp_path / "contact.html").read_text()
    assert 'src="kim-daily/0.webp"' in page
    assert "Joe Vanella</h2><p>none found" in page
