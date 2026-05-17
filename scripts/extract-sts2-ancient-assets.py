#!/usr/bin/env python3
"""Extract current STS2 Ancient profile assets from the local Godot PCK."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lib.ctex as ctex  # noqa: E402
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


ANCIENT_IDS = ("darv", "neow", "nonupeipe", "orobas", "pael", "tanx", "tezcatara", "vakuu")

BACKGROUND_IMPORTS = {
    "neow": "animations/backgrounds/neow_room/neow_bg.png.import",
}


def extract_texture(reader: PCKReader, import_path: str):
    raw_import = reader.read_file(import_path)
    target = parse_import_file(raw_import)
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{import_path}: texture target not found: {target}")

    image = ctex_to_image(reader.read_file(target))
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode texture target: {target}")
    return image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--out-root", default="public/images/sts2", help="Image output root under the repo")
    parser.add_argument("--force", action="store_true", help="Overwrite existing extracted files")
    args = parser.parse_args()

    if ctex.Image is None:
        raise RuntimeError("Pillow is required to decode Godot .ctex textures. Install with: python3 -m pip install Pillow")

    out_root = (REPO_ROOT / args.out_root).resolve()
    ancient_dir = out_root / "ancients"
    background_dir = out_root / "ancients-bg"
    ancient_dir.mkdir(parents=True, exist_ok=True)
    background_dir.mkdir(parents=True, exist_ok=True)

    with PCKReader(args.pck) as reader:
        for ancient_id in ANCIENT_IDS:
            out_path = ancient_dir / f"{ancient_id}.webp"
            if out_path.exists() and not args.force:
                continue
            image = extract_texture(reader, f"images/ui/run_history/{ancient_id}.png.import")
            image.save(out_path, "WEBP", lossless=True, method=6)
            print(f"extracted Ancient token: {out_path.relative_to(REPO_ROOT)}")

        for ancient_id, import_path in BACKGROUND_IMPORTS.items():
            out_path = background_dir / f"{ancient_id}_bg.webp"
            if out_path.exists() and not args.force:
                continue
            image = extract_texture(reader, import_path)
            image.convert("RGB").save(out_path, "WEBP", quality=92, method=6)
            print(f"extracted Ancient background: {out_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
