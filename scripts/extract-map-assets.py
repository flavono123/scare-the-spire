#!/usr/bin/env python3
"""Extract STS2 map UI assets from the local PCK.

Outputs:
- public/images/sts2/map/backgrounds/<act>/{top,middle,bottom}.png
- public/images/sts2/boss-nodes/boss_node_<boss>{,_outline}.webp
- public/images/sts2/map/icons/*.png
- public/images/sts2/map/outlines/*.png
- public/images/sts2/map/effects/*.png
- public/images/sts2/map/markers/*.png

This script handles both:
- GPU-compressed .ctex atlases (BC7 / BC3) via scripts.lib.ctex
- AtlasTexture crops defined in .tres sprite resources
- Direct imported PNG assets for map backgrounds / markers
"""

from __future__ import annotations

import argparse
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


ICON_SPRITES = [
    "map_burly_monster",
    "map_chest",
    "map_chest_boss",
    "map_elite",
    "map_monster",
    "map_node_background",
    "map_rest",
    "map_shop",
    "map_unknown",
    "map_unknown_chest",
    "map_unknown_elite",
    "map_unknown_monster",
    "map_unknown_shop",
]

OUTLINE_SPRITES = [
    "map_chest_boss_outline",
    "map_chest_outline",
    "map_circle_0",
    "map_circle_1",
    "map_circle_2",
    "map_circle_3",
    "map_circle_4",
    "map_complete_icon",
    "map_dot",
    "map_elite_outline",
    "map_monster_outline",
    "map_rest_outline",
    "map_select_box",
    "map_shop_outline",
    "map_unknown_outline",
]

DIRECT_MARKER_IMPORTS = {
    "map_ping": "images/packed/map/icons/map_ping.png.import",
    "map_spoils_map_marker": "images/packed/map/icons/map_spoils_map_marker.png.import",
    "map_marker_ironclad": "images/packed/map/icons/map_marker_ironclad.png.import",
    "map_marker_silent": "images/packed/map/icons/map_marker_silent.png.import",
    "map_marker_defect": "images/packed/map/icons/map_marker_defect.png.import",
    "map_marker_necrobinder": "images/packed/map/icons/map_marker_necrobinder.png.import",
    "map_marker_regent": "images/packed/map/icons/map_marker_regent.png.import",
}

# Boss node/outline assets — parallels ANCIENT_ASSETS on the frontend.
# Keys are the bossKey (suffix `_boss` stripped) as produced by normalizeModelKey().
# Only bosses that ship a static placeholder icon set are listed here; the 3
# Spine-rendered bosses (ceremonial_beast, queen, the_insatiable) fall back to
# full-portrait rendering on the frontend.
BOSS_NODE_IMPORTS = {
    "doormaker": {
        "node": "images/map/placeholder/doormaker_boss_icon.png.import",
        "outline": "images/map/placeholder/doormaker_boss_icon_outline.png.import",
    },
    "kaiser_crab": {
        "node": "images/map/placeholder/kaiser_crab_boss_icon.png.import",
        "outline": "images/map/placeholder/kaiser_crab_boss_icon_outline.png.import",
    },
    "knowledge_demon": {
        "node": "images/map/placeholder/knowledge_demon_boss_icon.png.import",
        "outline": "images/map/placeholder/knowledge_demon_boss_icon_outline.png.import",
    },
    "lagavulin_matriarch": {
        "node": "images/map/placeholder/lagavulin_matriarch_boss_icon.png.import",
        "outline": "images/map/placeholder/lagavulin_matriarch_boss_icon_outline.png.import",
    },
    "soul_fysh": {
        "node": "images/map/placeholder/soul_fysh_boss_icon.png.import",
        "outline": "images/map/placeholder/soul_fysh_boss_icon_outline.png.import",
    },
    "test_subject": {
        "node": "images/map/placeholder/test_subject_boss_icon.png.import",
        "outline": "images/map/placeholder/test_subject_boss_icon_outline.png.import",
    },
    "the_kin": {
        "node": "images/map/placeholder/the_kin_boss_icon.png.import",
        "outline": "images/map/placeholder/the_kin_boss_icon_outline.png.import",
    },
    "vantom": {
        "node": "images/map/placeholder/vantom_boss_icon.png.import",
        "outline": "images/map/placeholder/vantom_boss_icon_outline.png.import",
    },
    "waterfall_giant": {
        "node": "images/map/placeholder/waterfall_giant_boss_icon.png.import",
        "outline": "images/map/placeholder/waterfall_giant_boss_icon_outline.png.import",
    },
}

ACT_MAP_BG_COLORS = {
    "overgrowth": "A78A67",
    "underdocks": "9F95A5",
    "hive": "9B9562",
    "glory": "819A97",
}

MAP_BG_IMPORTS = {
    "overgrowth": {
        "top": "images/packed/map/map_bgs/overgrowth/map_top_overgrowth.png.import",
        "middle": "images/packed/map/map_bgs/overgrowth/map_middle_overgrowth.png.import",
        "bottom": "images/packed/map/map_bgs/overgrowth/map_bottom_overgrowth.png.import",
    },
    "hive": {
        "top": "images/packed/map/map_bgs/hive/map_top_hive.png.import",
        "middle": "images/packed/map/map_bgs/hive/map_middle_hive.png.import",
        "bottom": "images/packed/map/map_bgs/hive/map_bottom_hive.png.import",
    },
    "glory": {
        "top": "images/packed/map/map_bgs/glory/map_top_glory.png.import",
        "middle": "images/packed/map/map_bgs/glory/map_middle_glory.png.import",
        "bottom": "images/packed/map/map_bgs/glory/map_bottom_glory.png.import",
    },
    "underdocks": {
        "top": "images/packed/map/map_bgs/underdocks/map_top_underdocks.png.import",
        "middle": "images/packed/map/map_bgs/underdocks/map_middle_underdocks.png.import",
        "bottom": "images/packed/map/map_bgs/underdocks/map_bottom_underdocks.png.import",
    },
}

ATLAS_REGION_RE = re.compile(r"region = Rect2\(([^)]+)\)")
ATLAS_PATH_RE = re.compile(r'path="res://([^"]+)"')
INITIAL_ICON_COLOR = (0.705882, 0.615686, 0.537255)
GRAY_COLOR = (0.5, 0.5, 0.5)
SHADED_ICON_NAMES = {
    "map_burly_monster",
    "map_chest",
    "map_chest_boss",
    "map_elite",
    "map_monster",
    "map_rest",
    "map_shop",
    "map_unknown",
    "map_unknown_chest",
    "map_unknown_elite",
    "map_unknown_monster",
    "map_unknown_shop",
}


@dataclass(frozen=True)
class AtlasSpriteSpec:
    name: str
    tres_path: str
    output_dir: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/map",
        help="Output directory root",
    )
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def atlas_specs() -> Iterable[AtlasSpriteSpec]:
    for name in ICON_SPRITES:
        yield AtlasSpriteSpec(
            name=name,
            tres_path=f"images/atlases/ui_atlas.sprites/map/icons/{name}.tres",
            output_dir="icons",
        )
    for name in OUTLINE_SPRITES:
        yield AtlasSpriteSpec(
            name=name,
            tres_path=f"images/atlases/compressed.sprites/map/{name}.tres",
            output_dir="outlines" if "outline" in name else "effects",
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
    if output_path.suffix.lower() == ".webp":
        image.save(output_path, format="WEBP", quality=90, method=6)
    else:
        image.save(output_path)
    return True


def hex_to_rgb01(value: str) -> tuple[float, float, float]:
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))


def lerp_color(
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    amount: float,
) -> tuple[float, float, float]:
    return tuple(start[i] * (1 - amount) + end[i] * amount for i in range(3))


def apply_map_icon_shader(image: Image.Image, act: str) -> Image.Image:
    target_color = lerp_color(hex_to_rgb01(ACT_MAP_BG_COLORS[act]), GRAY_COLOR, 0.5)
    recolored = image.convert("RGBA").copy()
    pixels = recolored.load()

    for y in range(recolored.height):
        for x in range(recolored.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            rgb = (r / 255, g / 255, b / 255)
            diff = math.sqrt(
                (rgb[0] - INITIAL_ICON_COLOR[0]) ** 2
                + (rgb[1] - INITIAL_ICON_COLOR[1]) ** 2
                + (rgb[2] - INITIAL_ICON_COLOR[2]) ** 2
            )
            if diff < 0.5:
                pixels[x, y] = (
                    round(target_color[0] * 255),
                    round(target_color[1] * 255),
                    round(target_color[2] * 255),
                    a,
                )

    return recolored


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        for spec in atlas_specs():
            output_path = output_root / spec.output_dir / f"{spec.name}.png"
            try:
                image = crop_atlas_sprite(reader, spec.tres_path)
            except Exception as exc:
                print(f"skip {spec.tres_path}: {exc}")
                skipped += 1
                continue

            if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                extracted += 1
            else:
                skipped += 1

            if spec.output_dir == "icons" and spec.name in SHADED_ICON_NAMES:
                for act in ACT_MAP_BG_COLORS:
                    shaded_output_path = (
                        output_root / "icons-by-act" / act / f"{spec.name}.png"
                    )
                    shaded = apply_map_icon_shader(image, act)
                    if save_image(shaded, shaded_output_path, dry_run=args.dry_run, force=args.force):
                        extracted += 1
                    else:
                        skipped += 1

        for marker_name, import_path in DIRECT_MARKER_IMPORTS.items():
            output_path = output_root / "markers" / f"{marker_name}.png"
            try:
                image = open_import_image(reader, import_path)
            except Exception as exc:
                print(f"skip {import_path}: {exc}")
                skipped += 1
                continue

            if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                extracted += 1
            else:
                skipped += 1

        boss_nodes_root = output_root.parent / "boss-nodes"
        for boss_key, imports in BOSS_NODE_IMPORTS.items():
            for variant, import_path in (("node", imports["node"]), ("outline", imports["outline"])):
                suffix = "_outline" if variant == "outline" else ""
                output_path = boss_nodes_root / f"boss_node_{boss_key}{suffix}.webp"
                try:
                    image = open_import_image(reader, import_path)
                except Exception as exc:
                    print(f"skip {import_path}: {exc}")
                    skipped += 1
                    continue

                if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                    extracted += 1
                else:
                    skipped += 1

        for act, parts in MAP_BG_IMPORTS.items():
            for part, import_path in parts.items():
                output_path = output_root / "backgrounds" / act / f"{part}.png"
                try:
                    image = open_import_image(reader, import_path)
                except Exception as exc:
                    print(f"skip {import_path}: {exc}")
                    skipped += 1
                    continue

                if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                    extracted += 1
                else:
                    skipped += 1

    print(f"done: {extracted} extracted, {skipped} skipped")
    print(f"output: {output_root}")


if __name__ == "__main__":
    main()
