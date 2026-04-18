#!/usr/bin/env python3
"""Extract boss map-token icons from the local STS2 PCK.

Source: `images/ui/run_history/{slug}_boss.png` (BC7/BPTC-compressed).
Output: `public/images/sts2/bosses/{slug}_boss.webp` (what the codex
encounters page loads).

Usage:
    python3 scripts/extract-boss-icons.py [--force] [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.pck import PCKReader, default_pck_path  # noqa: E402
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public/images/sts2/bosses"
SRC_PREFIX = "images/ui/run_history/"
SRC_SUFFIX = "_boss.png.import"


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract boss icons from STS2 PCK.")
    ap.add_argument("--pck", default=default_pck_path())
    ap.add_argument("--output", default=str(OUT_DIR))
    ap.add_argument("--force", action="store_true", help="Overwrite existing files.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    reader = PCKReader(args.pck)
    targets = []
    for p in reader.entries:
        if not p.startswith(SRC_PREFIX) or not p.endswith(SRC_SUFFIX):
            continue
        # Skip outline variants.
        name = p[len(SRC_PREFIX) : -len(".import")]
        if "_outline" in name:
            continue
        targets.append((p, name))  # name like "vantom_boss.png"

    targets.sort()
    print(f"Found {len(targets)} boss icons in PCK")

    written, skipped, failed = 0, 0, 0
    for import_path, filename in targets:
        slug = filename[: -len(".png")]
        out_path = out_dir / f"{slug}.webp"
        if out_path.exists() and not args.force:
            skipped += 1
            continue
        raw_import = reader.read_file(import_path)
        ctex_path = parse_import_file(raw_import)
        if not ctex_path or ctex_path not in reader.entries:
            print(f"  ! {slug}: missing .ctex path")
            failed += 1
            continue
        img = ctex_to_image(reader.read_file(ctex_path))
        if img is None:
            print(f"  ! {slug}: could not decode .ctex")
            failed += 1
            continue
        if args.dry_run:
            print(f"  - {slug}.webp ({img.size[0]}x{img.size[1]})")
        else:
            img.save(out_path, "WEBP", quality=95, method=6)
            print(f"  + {slug}.webp ({img.size[0]}x{img.size[1]})")
        written += 1

    reader.close()
    print(f"\n{'(dry-run) ' if args.dry_run else ''}{written} written, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
