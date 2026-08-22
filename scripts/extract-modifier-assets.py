#!/usr/bin/env python3
"""Extract STS2 run-modifier token icons from the local PCK.

Game source:
  images/packed/modifiers/*.png.import

Outputs:
  public/images/sts2/modifiers/<name>.webp
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT_DIR = ROOT / "public/images/sts2/modifiers"
IMPORT_PREFIX = "images/packed/modifiers/"
IMPORT_SUFFIX = ".png.import"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output", default=str(DEFAULT_OUT_DIR), help="Modifier image output directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing images")
    parser.add_argument("--dry-run", action="store_true", help="Print planned writes without writing files")
    return parser.parse_args()


def modifier_slug(path: str) -> str | None:
    if not path.startswith(IMPORT_PREFIX) or not path.endswith(IMPORT_SUFFIX):
        return None
    return path[len(IMPORT_PREFIX) : -len(IMPORT_SUFFIX)]


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output)
    reader = PCKReader(args.pck)
    imports = sorted(path for path in reader.entries if modifier_slug(path))
    written = 0
    skipped = 0

    for import_path in imports:
        slug = modifier_slug(import_path)
        if slug is None:
            continue
        output_path = output_dir / f"{slug}.webp"
        if output_path.exists() and not args.force:
            skipped += 1
            continue

        ctex_path = parse_import_file(reader.read_file(import_path))
        if not ctex_path or ctex_path not in reader.entries:
            raise RuntimeError(f"{import_path}: could not resolve .ctex path")
        image = ctex_to_image(reader.read_file(ctex_path))
        if image is None:
            raise RuntimeError(f"{import_path}: could not decode texture")

        if args.dry_run:
            print(f"would write {output_path} ({image.size[0]}x{image.size[1]})")
        else:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path, "WEBP", quality=95, method=6)
            print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")
        written += 1

    reader.close()
    print(f"modifier icons: wrote {written}, skipped {skipped}, found {len(imports)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
