"""Face-centred square headshots cut from Commons photos.

find_headshots.py uses crop() to decide a photo is usable; seed_season.py runs the same
crop on the same Commons thumbnail when it uploads. Needs opencv-python-headless, pinned
in the Seed Season and Test Backend workflows: the Lambda layer never imports this.

The detector is YuNet (face_detection_yunet_2023mar.onnx, MIT, from opencv/opencv_zoo).
OpenCV's bundled haar cascade missed 1 in 7 plain, well-lit portraits of the old picks.
"""

from __future__ import annotations

import hashlib
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np

from scripts.build_season import UA

MODEL = Path(__file__).with_name("face_detection_yunet_2023mar.onnx")
# A width Wikimedia pre-renders: other widths get throttled.
WIDTH = 960
SIZE = 256
SCORE = 0.8
# Longest side the detector sees.
DETECT = 640
# Part of every key: changing how a crop is cut changes every URL, so no cache keeps the old one.
RECIPE = f"yunet-{DETECT} {SIZE} webp"
# Under this many source pixels the face is a blur even in a 48px circle on a 3x screen.
MIN_FACE = 48
# A second face at least this fraction of the largest one's width is a second person.
CROWD = 0.4

_detector = cv2.FaceDetectorYN.create(str(MODEL), "", (320, 320), SCORE)


def thumb_url(file: str) -> str:
    return (
        "https://commons.wikimedia.org/wiki/Special:FilePath/"
        f"{urllib.parse.quote(file)}?width={WIDTH}"
    )


def fetch(file: str) -> bytes:
    req = urllib.request.Request(thumb_url(file), headers=UA)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 3:
                raise
        # Dropped connections ("No route to host") come and go.
        except urllib.error.URLError:
            if attempt == 3:
                raise
        time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def faces(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    """(x, y, w, h) of each face, widest first. Not thread-safe: one detector per process."""
    height, width = img.shape[:2]
    # YuNet misses faces that fill a large frame: Leah_Remini_in_2018.jpg at 960px wide.
    scale = min(1.0, DETECT / max(height, width))
    small = cv2.resize(
        img, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA
    )
    _detector.setInputSize((small.shape[1], small.shape[0]))
    _, found = _detector.detect(small)
    boxes = [tuple(int(v / scale) for v in f[:4]) for f in ([] if found is None else found)]
    return sorted(boxes, key=lambda f: -f[2])


def crop(data: bytes) -> bytes | None:
    """A SIZE px square webp around the one face in the photo, or None when there isn't one."""
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return None
    found = faces(img)
    if not found or found[0][2] < MIN_FACE:
        return None
    x, y, w, h = found[0]
    if any(f[2] >= CROWD * w for f in found[1:]):
        return None
    height, width = img.shape[:2]
    # Head and shoulders: the box runs brow to chin, so the square is 2.6 faces wide with
    # the face a little above centre.
    side = min(int(max(w, h) * 2.6), width, height)
    cx, cy = x + w // 2, y + h // 2 + h // 4
    left = min(max(cx - side // 2, 0), width - side)
    top = min(max(cy - side // 2, 0), height - side)
    square = cv2.resize(
        img[top : top + side, left : left + side], (SIZE, SIZE), interpolation=cv2.INTER_AREA
    )
    ok, out = cv2.imencode(".webp", square, [cv2.IMWRITE_WEBP_QUALITY, 85])
    assert ok
    return out.tobytes()


def key(name: str, sha1: str) -> str:
    """The S3 name of a person's crop: "witney-carson-<10 hex>.webp", hashed from the
    Commons file's sha1 and RECIPE."""
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_).strip("-")
    digest = hashlib.sha256(f"{sha1} {RECIPE}".encode()).hexdigest()[:10]
    return f"{slug}-{digest}.webp"
