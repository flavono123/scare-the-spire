#!/usr/bin/env python3
"""Extract STS2 inspect-relic slab assets from the local PCK.

Outputs under public/images/sts2/ui/inspect-relic/:
  - reward_panel.webp              (FrameBg stone slab)
  - relic_inspect_frame.webp       (ornamental ring, base)
  - relic_inspect_frame-{rarity}.webp  (HSV-baked per RelicRarity)

HSV values match NInspectRelicScreen.SetRarityVisuals.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import importlib.util

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

# Reuse HSV bake from confirm popup extractor (hyphenated filename).
_confirm_path = Path(__file__).resolve().parent / "extract-confirm-popup-assets.py"
_spec = importlib.util.spec_from_file_location("extract_confirm_popup_assets", _confirm_path)
assert _spec and _spec.loader
_confirm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_confirm)
apply_hsv = _confirm.apply_hsv

IMPORTS = {
    "reward_panel": "images/ui/reward_screen/reward_panel.png.import",
    "relic_inspect_frame": "images/packed/inspect_relic_screen/relic_inspect_frame.png.import",
}

# RelicRarity → (h, s, v) from NInspectRelicScreen.SetRarityVisuals
FRAME_HSV_BY_RARITY: dict[str, tuple[float, float, float]] = {
    "starter": (0.95, 0.25, 0.9),
    "common": (0.95, 0.25, 0.9),
    "uncommon": (0.426, 0.8, 1.1),
    "rare": (1.0, 0.8, 1.15),
    "shop": (0.525, 2.5, 0.85),
    "event": (0.23, 0.75, 0.9),
    "ancient": (0.875, 3.0, 0.9),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path())
    parser.add_argument("--output", default="public/images/sts2/ui/inspect-relic")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def open_import_image(reader: PCKReader, import_path: str) -> Image.Image:
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path:
        raise ValueError(f"Could not resolve .ctex path from {import_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"Could not decode {ctex_path}")
    return image.convert("RGBA")


def write_webp(path: Path, image: Image.Image, *, dry_run: bool) -> None:
    if dry_run:
        print(f"would write {path} ({image.size[0]}x{image.size[1]})")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=90, method=6)
    print(f"wrote {path} ({image.size[0]}x{image.size[1]})")


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    written = 0

    with PCKReader(args.pck) as reader:
        panel = open_import_image(reader, IMPORTS["reward_panel"])
        frame = open_import_image(reader, IMPORTS["relic_inspect_frame"])

        panel_path = output_root / "reward_panel.webp"
        frame_path = output_root / "relic_inspect_frame.webp"
        if args.force or args.dry_run or not panel_path.exists():
            write_webp(panel_path, panel, dry_run=args.dry_run)
            written += 1
        if args.force or args.dry_run or not frame_path.exists():
            write_webp(frame_path, frame, dry_run=args.dry_run)
            written += 1

        for rarity, hsv in FRAME_HSV_BY_RARITY.items():
            out = output_root / f"relic_inspect_frame-{rarity}.webp"
            if out.exists() and not args.force and not args.dry_run:
                continue
            write_webp(out, apply_hsv(frame, *hsv), dry_run=args.dry_run)
            written += 1

    print(f"done: {written} files")


if __name__ == "__main__":
    main()
