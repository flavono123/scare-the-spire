#!/usr/bin/env python3
"""Extract STS2 run-history node sprites from the local PCK.

Outputs every sprite under `images/ui/run_history/*.png.import` (62
files: 7 base node types + 4 unknown variants + 12 bosses + 8 ancients,
each with a matching `_outline` companion) to
`public/images/sts2/run-history/<name>.png`.

These are the colorful in-game node tokens used by the Run History
screen and by our history-course topbar's current-node chip. The
`_outline` variants are designed to sit *behind* the main fill at the
same size with `modulate = Color(0, 0, 0, 0.18)` (see
`scenes/ui/top_bar/second_boss_icon.tscn`).
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


IMPORT_RE = re.compile(r"^images/ui/run_history/(?P<name>.+)\.png\.import$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/run-history",
        help="Output directory",
    )
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        imports = sorted(p for p in reader.entries if IMPORT_RE.match(p))
        for ip in imports:
            name = IMPORT_RE.match(ip).group("name")  # type: ignore[union-attr]
            output_path = output_root / f"{name}.png"
            if output_path.exists() and not args.force:
                skipped += 1
                continue
            try:
                ctex_path = parse_import_file(reader.read_file(ip))
                if not ctex_path:
                    raise ValueError("could not resolve .ctex path")
                image = ctex_to_image(reader.read_file(ctex_path))
                if image is None:
                    raise ValueError("decode failed")
            except Exception as exc:
                print(f"skip {ip}: {exc}")
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
