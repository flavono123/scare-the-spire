#!/usr/bin/env python3
"""Extract STS2 timeline epoch portraits from the local PCK.

Source:
- `images/timeline/epoch_portraits/*.png.import`
- `images/timeline/epoch_portraits/placeholder/*.png.import`

Output:
- Official art: `public/images/sts2/epochs/<epoch_id>.webp`
- Beta/placeholder art: `public/images/sts2/epochs-beta/<epoch_id>.webp`
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


IMPORT_RE = re.compile(r"^images/timeline/epoch_portraits/(?P<name>.+)\.png\.import$")
OUT_DIR = Path("public/images/sts2/epochs")
BETA_OUT_DIR = Path("public/images/sts2/epochs-beta")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output", default=str(OUT_DIR), help="Output directory")
    parser.add_argument("--beta-output", default=str(BETA_OUT_DIR), help="Beta/placeholder output directory")
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    beta_output_root = Path(args.beta_output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        imports = sorted(p for p in reader.entries if IMPORT_RE.match(p))
        for import_path in imports:
            name = IMPORT_RE.match(import_path).group("name")  # type: ignore[union-attr]
            is_beta = name.startswith("placeholder/")
            if name.startswith("placeholder/"):
                name = name.removeprefix("placeholder/")
            output_root_for_import = beta_output_root if is_beta else output_root
            label = "beta" if is_beta else "official"
            output_path = output_root_for_import / f"{name}.webp"
            if output_path.exists() and not args.force:
                skipped += 1
                continue

            ctex_path = parse_import_file(reader.read_file(import_path))
            if not ctex_path:
                print(f"skip {import_path}: could not resolve .ctex path")
                skipped += 1
                continue

            image = ctex_to_image(reader.read_file(ctex_path))
            if image is None:
                print(f"skip {import_path}: decode failed")
                skipped += 1
                continue

            if args.dry_run:
                print(f"would write {label} {output_path} ({image.size[0]}x{image.size[1]})")
            else:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                image.save(output_path, "WEBP", quality=95, method=6)
                print(f"wrote {label} {output_path} ({image.size[0]}x{image.size[1]})")
            extracted += 1

    print(f"done: {extracted} extracted, {skipped} skipped")
    print(f"output: {output_root}")
    print(f"beta output: {beta_output_root}")


if __name__ == "__main__":
    main()
