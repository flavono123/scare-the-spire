#!/usr/bin/env python3
"""Extract STS2 monster Phobia Mode body textures from the local PCK."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from scripts.lib.pck import PCKReader, default_pck_path  # noqa: E402

PHOBIA_OUTPUT_DIR = ROOT / "public/images/sts2/monsters-phobia"
PHOBIA_DATA_PATH = ROOT / "data/sts2/monster-phobia-assets.json"
MAX_OUTPUT_DIMENSION = 1400

DIRECT_ASSETS = [
    {
        "id": "ENTOMANCER",
        "source": "images/monsters/phobia_mode/phobia_entomancer.png.import",
        "fileName": "entomancer.webp",
    },
    {
        "id": "PHROG_PARASITE",
        "source": "images/monsters/phobia_mode/phrog_parasite_phobia.png.import",
        "fileName": "phrog_parasite.webp",
    },
    {
        "id": "TERROR_EEL",
        "source": "images/monsters/phobia_mode/terror_eel_phobia.png.import",
        "fileName": "terror_eel.webp",
    },
    {
        "id": "THE_INSATIABLE",
        "source": "images/monsters/phobia_mode/the_insatiable_phobia.png.import",
        "fileName": "the_insatiable.webp",
    },
    {
        "id": "WRIGGLER",
        "source": "images/monsters/phobia_mode/wriggler_phobia.png.import",
        "fileName": "wriggler.webp",
    },
]

DECIMILLIPEDE_PARTS = [
    {
        "id": "back",
        "source": "images/monsters/phobia_mode/decimillipede_segment_back_phobia.png.import",
        "offset": (0, 86),
    },
    {
        "id": "middle",
        "source": "images/monsters/phobia_mode/decimillipede_segment_middle_phobia.png.import",
        "offset": (390, 84),
    },
    {
        "id": "front",
        "source": "images/monsters/phobia_mode/decimillipede_segment_front_phobia.png.import",
        "offset": (745, 0),
    },
]


def load_imported_image(reader: PCKReader, import_path: str):
    raw_import = reader.read_file(import_path)
    ctex_path = parse_import_file(raw_import)
    if not ctex_path:
        raise RuntimeError(f"No ctex path found in {import_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise RuntimeError(f"Could not decode {ctex_path}")
    return image, ctex_path


def save_webp(image, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, "WEBP", lossless=True, quality=95, method=6)


def fit_for_web(image):
    if max(image.width, image.height) <= MAX_OUTPUT_DIMENSION:
        return image
    resized = image.copy()
    resized.thumbnail((MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION), Image.Resampling.LANCZOS)
    return resized


def extract_direct_assets(reader: PCKReader) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for asset in DIRECT_ASSETS:
        image, ctex_path = load_imported_image(reader, asset["source"])
        output_image = fit_for_web(image)
        out_path = PHOBIA_OUTPUT_DIR / asset["fileName"]
        save_webp(output_image, out_path)
        records.append({
            "id": asset["id"],
            "imageUrl": f"/images/sts2/monsters-phobia/{asset['fileName']}",
            "source": asset["source"],
            "ctex": ctex_path,
            "width": output_image.width,
            "height": output_image.height,
        })
    return records


def extract_decimillipede(reader: PCKReader) -> dict[str, object]:
    loaded_parts = []
    for part in DECIMILLIPEDE_PARTS:
        image, ctex_path = load_imported_image(reader, part["source"])
        loaded_parts.append((part, image, ctex_path))

    width = max(part["offset"][0] + image.width for part, image, _ in loaded_parts)
    height = max(part["offset"][1] + image.height for part, image, _ in loaded_parts)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for part, image, _ in loaded_parts:
        canvas.alpha_composite(image, dest=part["offset"])

    output_image = fit_for_web(canvas)
    out_path = PHOBIA_OUTPUT_DIR / "decimillipede.webp"
    save_webp(output_image, out_path)
    return {
        "id": "DECIMILLIPEDE_SEGMENT",
        "imageUrl": "/images/sts2/monsters-phobia/decimillipede.webp",
        "source": [part["source"] for part, _, _ in loaded_parts],
        "ctex": [ctex_path for _, _, ctex_path in loaded_parts],
        "width": output_image.width,
        "height": output_image.height,
    }


def write_json(path: Path, records: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(list(records), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    args = parser.parse_args()

    with PCKReader(args.pck) as reader:
        records = [extract_decimillipede(reader), *extract_direct_assets(reader)]

    write_json(PHOBIA_DATA_PATH, records)
    print(f"Wrote {len(records)} phobia-mode monster assets to {PHOBIA_DATA_PATH}")


if __name__ == "__main__":
    main()
