#!/usr/bin/env python3
"""Extract STS2 Compendium scrollbar sprites from the local PCK.

Outputs under public/images/sts2/ui/scrollbar/:
  - track_center.png / track_edge.png / train.png          (large, card library)
  - small_track_center.png / small_track_edge.png / small_train.png

Track pieces are baked with scrollbar.tscn Track* modulate
Color(0.164706, 0.290196, 0.321569, 1). The gold train is unmodulated.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

ATLAS_PATH_RE = re.compile(r'path="res://([^"]+)"')
ATLAS_REGION_RE = re.compile(r"region = Rect2\(([^)]+)\)")

# scenes/ui/scrollbar.tscn TrackBody/TrackTop/TrackBot modulate
TRACK_MODULATE = (0.164706, 0.290196, 0.321569)

SPECS: dict[str, tuple[str, bool]] = {
    # name -> (tres path, apply track modulate?)
    "track_center": (
        "images/atlases/ui_atlas.sprites/scrollbar_track_center.tres",
        True,
    ),
    "track_edge": (
        "images/atlases/ui_atlas.sprites/scrollbar_track_edge2.tres",
        True,
    ),
    "train": (
        "images/atlases/ui_atlas.sprites/scrollbar_train_large.tres",
        False,
    ),
    "small_track_center": (
        "images/atlases/ui_atlas.sprites/small_scrollbar_track_center.tres",
        True,
    ),
    "small_track_edge": (
        "images/atlases/ui_atlas.sprites/small_scrollbar_track_edge.tres",
        True,
    ),
    "small_train": (
        "images/atlases/ui_atlas.sprites/small_scrollbar_train.tres",
        False,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/ui/scrollbar",
        help="Output directory",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def open_import_image(reader: PCKReader, import_path: str) -> Image.Image:
    ctex_path = parse_import_file(reader.read_file(import_path))
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
    atlas_image = open_import_image(reader, f"{atlas_match.group(1)}.import")
    x, y, width, height = [
        int(float(part.strip()))
        for part in region_match.group(1).split(",")
    ]
    return atlas_image.crop((x, y, x + width, y + height))


def apply_modulate(image: Image.Image, modulate: tuple[float, float, float]) -> Image.Image:
    source = image.convert("RGBA")
    pixels = source.load()
    width, height = source.size
    output = Image.new("RGBA", (width, height))
    out = output.load()
    mr, mg, mb = modulate
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                out[x, y] = (0, 0, 0, 0)
                continue
            out[x, y] = (
                max(0, min(255, int(r * mr + 0.5))),
                max(0, min(255, int(g * mg + 0.5))),
                max(0, min(255, int(b * mb + 0.5))),
                a,
            )
    return output


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        for name, (tres_path, modulate_track) in SPECS.items():
            output_path = output_root / f"{name}.png"
            if output_path.exists() and not args.force and not args.dry_run:
                skipped += 1
                continue
            try:
                image = crop_atlas_sprite(reader, tres_path)
                if modulate_track:
                    image = apply_modulate(image, TRACK_MODULATE)
            except Exception as exc:
                print(f"skip {tres_path}: {exc}")
                skipped += 1
                continue

            if args.dry_run:
                print(f"would write {output_path} ({image.size[0]}x{image.size[1]})")
                extracted += 1
                continue

            output_root.mkdir(parents=True, exist_ok=True)
            image.save(output_path)
            extracted += 1
            print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")

    print(f"done: {extracted} extracted, {skipped} skipped")


if __name__ == "__main__":
    main()
