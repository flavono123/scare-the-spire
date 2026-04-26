#!/usr/bin/env python3
"""Extract STS2 in-run topbar/HUD icons from the local PCK.

Outputs:
- public/images/sts2/ui/topbar/<name>.png
  - top_bar (nine-patch background)
  - top_bar_heart, top_bar_gold, top_bar_floor, top_bar_deck, top_bar_map,
    top_bar_settings, top_bar_ascension, top_bar_char_backdrop
  - timer_icon
  - submenu_history_icon (history/scroll icon)
  - potion_placeholder (empty potion slot)

Mirrors the extract-map-assets.py flow:
- AtlasTexture .tres in ui_atlas → crop region
- Direct .png.import for the standalone history + potion placeholder PNGs
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


TOP_BAR_ATLAS_SPRITES = [
    "top_bar",
    "top_bar_ascension",
    "top_bar_char_backdrop",
    "top_bar_deck",
    "top_bar_floor",
    "top_bar_gold",
    "top_bar_heart",
    "top_bar_map",
    "top_bar_settings",
    "timer_icon",
]

DIRECT_IMPORTS = {
    "submenu_history_icon": "images/packed/main_menu/submenu_history_icon.png.import",
    "potion_placeholder": "images/packed/potions/potion_placeholder.png.import",
}

ATLAS_REGION_RE = re.compile(r"region = Rect2\(([^)]+)\)")
ATLAS_PATH_RE = re.compile(r'path="res://([^"]+)"')


@dataclass(frozen=True)
class AtlasSpriteSpec:
    name: str
    tres_path: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/ui/topbar",
        help="Output directory",
    )
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def atlas_specs() -> Iterable[AtlasSpriteSpec]:
    for name in TOP_BAR_ATLAS_SPRITES:
        yield AtlasSpriteSpec(
            name=name,
            tres_path=f"images/atlases/ui_atlas.sprites/top_bar/{name}.tres",
        )


def open_import_image(reader: PCKReader, import_path: str) -> Image.Image:
    raw_import = reader.read_file(import_path)
    ctex_path = parse_import_file(raw_import)
    if not ctex_path:
        raise ValueError(f"Could not resolve .ctex path from {import_path}")

    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"Could not decode {ctex_path}")
    return image


def crop_atlas_sprite(reader: PCKReader, tres_path: str) -> Image.Image:
    text = reader.read_file(tres_path).decode("utf-8", errors="replace")
    atlas_match = ATLAS_PATH_RE.search(text)
    region_match = ATLAS_REGION_RE.search(text)
    if not atlas_match or not region_match:
        raise ValueError(f"Could not parse atlas sprite {tres_path}")

    atlas_import_path = f"{atlas_match.group(1)}.import"
    atlas_image = open_import_image(reader, atlas_import_path)
    x, y, width, height = [
        int(float(part.strip()))
        for part in region_match.group(1).split(",")
    ]
    return atlas_image.crop((x, y, x + width, y + height))


def save_image(image: Image.Image, output_path: Path, *, dry_run: bool, force: bool) -> bool:
    if output_path.exists() and not force:
        return False
    if dry_run:
        print(f"would write {output_path}")
        return True

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    return True


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        for spec in atlas_specs():
            output_path = output_root / f"{spec.name}.png"
            try:
                image = crop_atlas_sprite(reader, spec.tres_path)
            except Exception as exc:
                print(f"skip {spec.tres_path}: {exc}")
                skipped += 1
                continue

            if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                extracted += 1
                print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")
            else:
                skipped += 1

        for name, import_path in DIRECT_IMPORTS.items():
            output_path = output_root / f"{name}.png"
            try:
                image = open_import_image(reader, import_path)
            except Exception as exc:
                print(f"skip {import_path}: {exc}")
                skipped += 1
                continue

            if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                extracted += 1
                print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")
            else:
                skipped += 1

    print(f"done: {extracted} extracted, {skipped} skipped")
    print(f"output: {output_root}")


if __name__ == "__main__":
    main()
