#!/usr/bin/env python3
"""Extract STS2 rest-site camp backgrounds and option buttons from the local PCK.

Outputs:
  public/images/sts2/ui/rest-site/
    option_outline.webp, option_{heal,smith,dig,...}.webp
  public/images/sts2/rooms/rest-sites/
    overgrowth_rest_site_bg.webp, overgrowth_rest_site_fire.webp
    hive_rest_site_00.webp, hive_rest_site_fire.webp
    glory_rest_site_00.webp, glory_rest_site_fire.webp
    underdocks_rest_site_bg.webp, underdocks_rest_site_fire.webp

Sources:
  images/ui/rest_site/*.png.import
  images/rooms/rest_sites/{overgrowth,hive,glory,underdocks}/*.png.import
"""

from __future__ import annotations

import argparse
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

OPTION_IMPORTS = {
    "option_outline": "images/ui/rest_site/option_outline.png.import",
    "option_heal": "images/ui/rest_site/option_heal.png.import",
    "option_smith": "images/ui/rest_site/option_smith.png.import",
    "option_dig": "images/ui/rest_site/option_dig.png.import",
    "option_lift": "images/ui/rest_site/option_lift.png.import",
    "option_cook": "images/ui/rest_site/option_cook.png.import",
    "option_clone": "images/ui/rest_site/option_clone.png.import",
    "option_hatch": "images/ui/rest_site/option_hatch.png.import",
    "option_kindle": "images/ui/rest_site/option_kindle.png.import",
    "option_mend": "images/ui/rest_site/option_mend.png.import",
    "option_toke": "images/ui/rest_site/option_toke.png.import",
}

CAMP_IMPORTS = {
    "overgrowth_rest_site_bg": "images/rooms/rest_sites/overgrowth/overgrowth_rest_site_bg.png.import",
    "overgrowth_rest_site_fire": "images/rooms/rest_sites/overgrowth/overgrowth_rest_site_fire.png.import",
    "hive_rest_site_00": "images/rooms/rest_sites/hive/hive_rest_site_00.png.import",
    "hive_rest_site_fire": "images/rooms/rest_sites/hive/hive_rest_site_fire.png.import",
    "glory_rest_site_00": "images/rooms/rest_sites/glory/glory_rest_site_00.png.import",
    "glory_rest_site_fire": "images/rooms/rest_sites/glory/glory_rest_site_fire.png.import",
    "underdocks_rest_site_bg": "images/rooms/rest_sites/underdocks/underdocks_rest_site_bg.png.import",
    "underdocks_rest_site_fire": "images/rooms/rest_sites/underdocks/underdocks_rest_site_fire.png.import",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path())
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def open_import_image(reader: PCKReader, import_path: str):
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path:
        raise ValueError(f"Could not resolve .ctex path from {import_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"Could not decode {ctex_path}")
    return image.convert("RGBA")


def write_webp(path: Path, image, *, dry_run: bool, force: bool) -> bool:
    if path.exists() and not force and not dry_run:
        print(f"skip {path}")
        return False
    if dry_run:
        print(f"would write {path} ({image.size[0]}x{image.size[1]})")
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=90, method=6)
    print(f"wrote {path} ({image.size[0]}x{image.size[1]})")
    return True


def main() -> None:
    args = parse_args()
    option_root = Path("public/images/sts2/ui/rest-site")
    camp_root = Path("public/images/sts2/rooms/rest-sites")
    written = 0

    with PCKReader(args.pck) as reader:
        for name, import_path in OPTION_IMPORTS.items():
            image = open_import_image(reader, import_path)
            if write_webp(option_root / f"{name}.webp", image, dry_run=args.dry_run, force=args.force):
                written += 1
        for name, import_path in CAMP_IMPORTS.items():
            image = open_import_image(reader, import_path)
            if write_webp(camp_root / f"{name}.webp", image, dry_run=args.dry_run, force=args.force):
                written += 1

    print(f"done: {written} files")


if __name__ == "__main__":
    main()
