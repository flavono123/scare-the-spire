#!/usr/bin/env python3
"""Extract the game's icons for card tags that have no other Compendium image.

The Fool's melody symbols mark Wah/Cho/Ki cards in combat, and the Fool's arrow
stands for Shoot cards (the game's "화살" hover tip). Tarot is a service tag (the
game's TarotCards list has no CardTag or icon), so it takes the wheel from the Wheel
of Fortune tarot card portrait, masked to a round emblem. Minion, Shiv and Osty Attack
reuse power icons the site already serves, so they are not extracted here.

Usage: python3 scripts/extract-card-tag-icons.py
"""
from __future__ import annotations

from PIL import Image, ImageDraw

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from scripts.lib.pck import PCKReader, default_pck_path  # noqa: E402

OUT_DIR = REPO_ROOT / "public/images/sts2/card-tags"
ICONS = {
    "wah": "res://images/packed/fool/symbol_wah.png",
    "cho": "res://images/packed/fool/symbol_cho.png",
    "ki": "res://images/packed/fool/symbol_ki.png",
    "shoot": "res://images/packed/fool/arrow.png",
    "tarot": "res://images/packed/card_portraits/token/beta/wheel_of_fortune.png",
}


def main() -> int:
    pck = PCKReader(default_pck_path())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug, res_path in ICONS.items():
        source = res_path.removeprefix("res://")
        ctex_path = parse_import_file(pck.read_file(f"{source}.import"))
        if ctex_path is None:
            raise SystemExit(f"No texture in {source}.import")
        image = ctex_to_image(pck.read_file(ctex_path))
        if image is None:
            raise SystemExit(f"Could not decode {ctex_path}")
        image = image.convert("RGBA")
        if slug == "shoot":
            # The arrow sprite points straight down; lay it to point up-right so it fills a square chip.
            image = image.rotate(135, resample=3, expand=True)
        if slug == "tarot":
            # Square on the wheel, then keep only the disc inside its outer ring.
            w, h = image.size
            side = int(h * 0.86)
            left, top = (w - side) // 2, (h - side) // 2
            image = image.crop((left, top, left + side, top + side))
            mask = Image.new("L", image.size, 0)
            inset = int(side * 0.035)
            ImageDraw.Draw(mask).ellipse((inset, inset, side - inset, side - inset), fill=255)
            image.putalpha(mask)
        bbox = image.getbbox()
        if bbox:
            image = image.crop(bbox)
        out = OUT_DIR / f"{slug}.webp"
        image.save(out, "WEBP", quality=90, method=6)
        print(f"{slug}: {source} {image.size} -> {out.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
