#!/usr/bin/env python3
"""Extract STS2 in-run deck-view and run-history deck-row assets from the PCK.

Outputs under `public/images/sts2/ui/deck-view/`:

- color_tab_bar.png — NCardViewSortButton / deck-view sorter background
- sort_descending.png — sorter direction glyph (FlipV when ascending)
- checkbox_ticked.png / checkbox_unticked.png — deck-view View Upgrades tickbox
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


ATLAS_REGION_RE = re.compile(r"region = Rect2\(([^)]+)\)")
ATLAS_PATH_RE = re.compile(r'path="res://([^"]+)"')

ATLAS_SPRITES = {
    "sort_descending": "images/atlases/ui_atlas.sprites/sort_descending.tres",
    "checkbox_ticked": "images/atlases/ui_atlas.sprites/checkbox_ticked.tres",
    "checkbox_unticked": "images/atlases/ui_atlas.sprites/checkbox_unticked.tres",
}

DIRECT_IMPORTS = {
    "color_tab_bar": "images/ui/color_tab_bar.png.import",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/ui/deck-view",
        help="Output directory",
    )
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


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
        print(f"would write {output_path} ({image.size[0]}x{image.size[1]})")
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
        for name, tres_path in ATLAS_SPRITES.items():
            output_path = output_root / f"{name}.png"
            try:
                image = crop_atlas_sprite(reader, tres_path)
            except Exception as exc:
                print(f"skip {tres_path}: {exc}")
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
