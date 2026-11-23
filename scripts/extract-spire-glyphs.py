#!/usr/bin/env python3
"""Cut the invented-writing samples listed in data/dev/spire-glyphs.json out of the game files.

The catalogue (families, notes, where each sample sits in the game files) is hand-written in that JSON;
this script only renders one image per item so the dev admin tab (/dev/admin?tab=glyphs) can show them.
Images go to data/dev/spire-glyphs/<item id>.webp, outside public/, so they never count as deployed assets.

Item `source` forms:
  {"game": "sts2", "path": "<res path>.png"}                 whole STS2 texture
  {"game": "sts1", "path": "images/....png|jpg"}             whole STS1 jar image
  ... "crop": [x0, y0, x1, y1]                               fractions of the image
  ... "frame": [cols, rows, index]                           one frame of a sprite sheet
  {"game": "sts2", "atlas": "<spine atlas>", "region": "…"}  one Spine atlas region
  {"recipe": "ring-period" | "glyph-table"}                  derived figures built below

    python3 scripts/extract-spire-glyphs.py [--archive-version 0.113.0]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader  # noqa: E402
from lib.sts1_jar import open_sts1_jar  # noqa: E402

MANIFEST = os.path.join(ROOT, "data", "dev", "spire-glyphs.json")
OUT_DIR = os.path.join(ROOT, "data", "dev", "spire-glyphs")
MAX_SIDE = 640  # catalogue thumbnails, not archival copies
MIN_SIDE = 160  # tiny sprites are scaled up (short side) so the strokes are readable
# One period of the Knowledge Demon ring in the unrolled strip (x, width per glyph), measured once by hand.
RING_PERIOD = [(334, 23), (365, 29), (403, 28), (440, 28), (477, 28), (512, 25), (550, 20), (584, 28), (620, 25), (656, 28)]


class Games:
    def __init__(self, pck_path: str):
        self.pck = PCKReader(pck_path)
        self.jar = open_sts1_jar()
        self._atlases: dict[str, tuple[dict, dict]] = {}

    def sts2(self, path: str) -> Image.Image:
        raw = self.pck.read_file(parse_import_file(self.pck.read_file(f"{path}.import")))
        return ctex_to_image(raw).convert("RGBA")

    def sts1(self, path: str) -> Image.Image:
        with self.jar.open(path) as handle:
            return Image.open(handle).convert("RGBA")

    def region(self, atlas: str, name: str) -> Image.Image:
        if atlas not in self._atlases:
            entries = self.pck.entries
            packed = next(e for e in entries if e.endswith(".spatlas") and e.split("/")[-1].startswith(f"{atlas}.atlas-"))
            folder = next(e for e in entries if e.endswith(f"/{atlas}.atlas.import")).rsplit("/", 1)[0]
            regions: dict[str, dict] = {}
            pages: dict[str, Image.Image] = {}
            page = current = None
            for line in json.loads(self.pck.read_file(packed))["atlas_data"].splitlines():
                if not line.strip():
                    current = None
                elif line.strip().endswith(".png") and ":" not in line:
                    page = line.strip()
                    pages[page] = self.sts2(f"{folder}/{page}")
                elif not line.startswith((" ", "\t")) and ":" not in line:
                    current = line.strip()
                    regions[current] = {"page": page}
                elif current and ":" in line:
                    key, value = line.strip().split(":", 1)
                    regions[current][key] = value.strip()
            self._atlases[atlas] = (regions, pages)
        regions, pages = self._atlases[atlas]
        info = regions[name]
        x, y, w, h = map(int, info["bounds"].split(","))
        if info.get("rotate") in ("true", "90"):  # packed rotated 90° counter-clockwise
            return pages[info["page"]].crop((x, y, x + h, y + w)).rotate(-90, expand=True)
        return pages[info["page"]].crop((x, y, x + w, y + h))


def ink(image: Image.Image, threshold: int) -> np.ndarray:
    return np.array(image)[:, :, 3] > threshold


def runs(profile: np.ndarray, min_gap: int, min_size: int = 5) -> list[tuple[int, int]]:
    """Spans of non-empty lines separated by at least min_gap empty ones."""
    found, start, gap = [], None, 0
    for index, value in enumerate(profile):
        if value > 0:
            start = index if start is None else start
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                found.append((start, index - gap + 1))
                start = None
    if start is not None:
        found.append((start, len(profile)))
    return [span for span in found if span[1] - span[0] >= min_size]


def unroll_ring(games: Games) -> np.ndarray:
    """Knowledge Demon glyph ring as a straight strip, glyph tops (outer edge) up."""
    alpha = np.array(games.region("knowledge_demon", "scripty_circle_1"))[:, :, 3].astype(float)
    ys, xs = np.nonzero(alpha > 40)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    radius = np.hypot(xs - cx, ys - cy)
    inner, outer = radius.min() - 4, radius.max() + 4
    height, width = int(outer - inner), int(math.pi * (inner + outer))
    theta = 2 * math.pi * np.arange(width) / width - math.pi / 2
    r = outer - np.arange(height)[:, None]
    px = np.clip(np.rint(cx + r * np.cos(theta)).astype(int), 0, alpha.shape[1] - 1)
    py = np.clip(np.rint(cy + r * np.sin(theta)).astype(int), 0, alpha.shape[0] - 1)
    return alpha[py, px] > 60


def white(mask: np.ndarray) -> Image.Image:
    alpha = Image.fromarray((mask * 255).astype("uint8"))
    return Image.merge("RGBA", [alpha.point(lambda _: 255)] * 3 + [alpha])


def tile(mask: np.ndarray, size: int = 96, pad: int = 10) -> Image.Image:
    ys, xs = np.nonzero(mask)
    glyph = Image.fromarray((mask[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1] * 255).astype("uint8"))
    scale = (size - 2 * pad) / max(glyph.size)
    glyph = glyph.resize((max(1, int(glyph.width * scale)), max(1, int(glyph.height * scale))), Image.LANCZOS)
    out = Image.new("L", (size, size), 0)
    out.paste(glyph, ((size - glyph.width) // 2, (size - glyph.height) // 2))
    return out


def glyph_table(games: Games) -> Image.Image:
    """Every discrete glyph, normalised to one size, one row per source."""
    strip = unroll_ring(games)
    sign = ink(games.region("knowledge_demon", "OOO_sign"), 40)
    kin = ink(games.sts2("images/vfx/monsters/kin_priest/kin_crypto_particles.png"), 150)
    doll = np.array(games.sts2("images/packed/vfx/event/doll_room_whispers.png"))
    doll_fill = (doll[:, :, 3] > 120) & (doll[:, :, :3].max(axis=2) > 170)  # white fill without the dark outline
    rows = {
        "KD ring": [tile(strip[:, x : x + w]) for x, w in RING_PERIOD],
        "KD sign": [tile(sign[a:b]) for a, b in runs(sign.sum(axis=1), 6)],
        "Scroll": [tile(ink(games.region("scroll_of_biting", f"rune{n}"), 60)) for n in range(1, 5)],
        "Kin": [tile(kin[a:b][:, c:d]) for a, b in runs(kin.sum(axis=1), 3) for c, d in runs(kin[a:b].sum(axis=0), 3)],
        "Doll": [tile(doll_fill[:, c:d]) for c, d in runs(doll_fill.sum(axis=0), 1)],
        "Fool": [tile(ink(games.sts2(f"images/packed/fool/symbol_{n}.png"), 60)) for n in ("wah", "cho", "ki")],
    }
    counts = {name: len(tiles) for name, tiles in rows.items()}
    assert counts == {"KD ring": 10, "KD sign": 5, "Scroll": 4, "Kin": 9, "Doll": 3, "Fool": 3}, counts
    sheet = Image.new("RGB", (110 + 10 * 104, len(rows) * 126 + 8), (24, 24, 30))
    draw = ImageDraw.Draw(sheet)
    for row, (name, tiles) in enumerate(rows.items()):
        draw.text((8, row * 126 + 50), name, fill=(255, 214, 90))
        for column, glyph in enumerate(tiles):
            sheet.paste(Image.merge("RGB", [glyph] * 3), (110 + column * 104, row * 126 + 8))
            draw.text((110 + column * 104 + 3, row * 126 + 108), str(column + 1), fill=(170, 170, 180))
    return sheet


def render(games: Games, source: dict) -> Image.Image:
    recipe = source.get("recipe")
    if recipe == "glyph-table":
        return glyph_table(games)
    if recipe == "ring-period":
        strip = unroll_ring(games)
        return white(strip[:, RING_PERIOD[0][0] - 4 : RING_PERIOD[-1][0] + RING_PERIOD[-1][1] + 4])
    if recipe:
        raise ValueError(f"unknown recipe {recipe}")
    if "atlas" in source:
        image = games.region(source["atlas"], source["region"])
    else:
        image = games.sts2(source["path"]) if source["game"] == "sts2" else games.sts1(source["path"])
    if "frame" in source:
        columns, rows_, index = source["frame"]
        w, h = image.width // columns, image.height // rows_
        image = image.crop(((index % columns) * w, (index // columns) * h, (index % columns + 1) * w, (index // columns + 1) * h))
    if "crop" in source:
        x0, y0, x1, y1 = source["crop"]
        image = image.crop((int(x0 * image.width), int(y0 * image.height), int(x1 * image.width), int(y1 * image.height)))
    return image


def fit(image: Image.Image) -> Image.Image:
    box = image.getbbox()
    image = image.crop(box) if box else image
    scale = min(MAX_SIDE / max(image.size), max(1.0, MIN_SIDE / min(image.size)))
    return image if scale == 1 else image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-version", default=None, help="defaults to archiveVersion in the manifest")
    parser.add_argument("--builds-dir", default=os.environ.get("STS2_BUILDS_DIR") or os.path.expanduser("~/sts2-builds"))
    args = parser.parse_args()
    with open(MANIFEST, encoding="utf8") as handle:
        manifest = json.load(handle)
    version = args.archive_version or manifest["archiveVersion"]
    games = Games(os.path.join(args.builds_dir, version, "SlayTheSpire2.app", "Contents", "Resources", "Slay the Spire 2.pck"))
    items = [item for group in manifest["groups"] for family in group["families"] for item in family["items"]]
    ids = [item["id"] for item in items]
    assert len(ids) == len(set(ids)), "duplicate item id"
    os.makedirs(OUT_DIR, exist_ok=True)
    for item in items:
        image = fit(render(games, item["source"]))
        image.save(os.path.join(OUT_DIR, f"{item['id']}.webp"), "WEBP", quality=88, method=6)
        print(f"{item['id']}: {image.width}x{image.height}")
    stale = sorted(set(os.listdir(OUT_DIR)) - {f"{i}.webp" for i in ids})
    for name in stale:  # keep the folder in step with the manifest
        os.remove(os.path.join(OUT_DIR, name))
        print(f"removed {name}")


if __name__ == "__main__":
    main()
