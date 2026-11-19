#!/usr/bin/env python3
"""Extract the STS2 achievement icons (stats screen) and make a NOPE tile for the ones the game has no art for.

Game source:
  - images/packed/achievements/unlocked/*.png.import (21 of the 33 achievements; the rest have no icon in the pck)
  - images/packed/achievements/achievement_border.png.import
  - data/sts2/kor/achievements.json (ids)

Outputs: public/images/sts2/achievements/{id}.webp, border.webp, nope.webp
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/images/sts2/achievements"
PREFIX = "images/packed/achievements/"


def load(reader: PCKReader, import_path: str) -> Image.Image:
    ctex = parse_import_file(reader.read_file(import_path))
    image = ctex_to_image(reader.read_file(ctex)) if ctex in reader.entries else None
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode texture")
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    reader = PCKReader(default_pck_path())
    ids = [item["id"].lower() for item in json.loads((ROOT / "data/sts2/kor/achievements.json").read_text())]
    have = []
    for slug in ids:
        path = f"{PREFIX}unlocked/{slug}.png.import"
        if path not in reader.entries:
            continue
        load(reader, path).save(OUT / f"{slug}.webp", "WEBP", quality=95, method=6)
        have.append(slug)
    border = load(reader, f"{PREFIX}achievement_border.png.import")
    border.save(OUT / "border.webp", "WEBP", quality=95, method=6)

    # The game has no icon for these: the border with NOPE on a dark plate, same size as the others.
    size = Image.open(OUT / f"{have[0]}.webp").size
    nope = Image.new("RGBA", size, (24, 28, 32, 255))
    scaled = border.convert("RGBA").resize(size)
    nope.alpha_composite(scaled)
    draw = ImageDraw.Draw(nope)
    font = ImageFont.truetype(str(ROOT / "public/fonts/kreon_bold.ttf"), size[1] // 4)
    draw.text((size[0] / 2, size[1] / 2), "NOPE", font=font, fill=(255, 246, 226, 255), anchor="mm",
              stroke_width=max(2, size[1] // 40), stroke_fill=(89, 52, 0, 255))
    nope.save(OUT / "nope.webp", "WEBP", quality=95, method=6)
    print(f"icons {len(have)}/{len(ids)}; no art: {[i for i in ids if i not in have]}; size {size}")


if __name__ == "__main__":
    main()
