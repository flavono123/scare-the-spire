#!/usr/bin/env python3
"""Extract STS2 multiplayer reaction wheel emote assets from the local PCK.

Outputs `images/ui/emote/*.png.import` to
`public/images/sts2/ui/emote/<name>.png`.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


ASSET_NAMES = (
    "exclaim",
    "happy_cultist",
    "heart",
    "question",
    "skull",
    "slime_sad",
    "thumb_down",
    "thumb_up",
    "wedge_2",
    "wedge_shadow",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output", default="public/images/sts2/ui/emote", help="Output directory")
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        for name in ASSET_NAMES:
            import_path = f"images/ui/emote/{name}.png.import"
            output_path = output_root / f"{name}.png"
            if output_path.exists() and not args.force:
                skipped += 1
                continue

            try:
                ctex_path = parse_import_file(reader.read_file(import_path))
                if not ctex_path:
                    raise ValueError("could not resolve .ctex path")
                image = ctex_to_image(reader.read_file(ctex_path))
                if image is None:
                    raise ValueError("decode failed")
            except Exception as exc:
                print(f"skip {import_path}: {exc}")
                skipped += 1
                continue

            if args.dry_run:
                print(f"would write {output_path}")
                extracted += 1
                continue

            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path)
            extracted += 1
            print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")

    print(f"done: {extracted} extracted, {skipped} skipped")
    print(f"output: {output_root}")


if __name__ == "__main__":
    main()
