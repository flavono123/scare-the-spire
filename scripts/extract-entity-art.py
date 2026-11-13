#!/usr/bin/env python3
"""Extract missing STS2 relic, potion, power and event art from the local PCK.

Only art for rows in data/sts2/eng/<kind>.json is written, as WebP, and
existing files are skipped unless --force is passed:

  relics   images/relics/<name>.png            -> public/images/sts2/relics/<name>.webp
           images/relics/<name>_<character>.png -> public/images/sts2/relics/<name>_<character>.webp
           images/relics/beta/<name>.png       -> public/images/sts2/relics-beta/<name>.webp
  potions  images/potions/large/<id>.png       -> public/images/sts2/potions/<id>.webp
  powers   images/powers/<name>.png            -> public/images/sts2/powers/<name>.webp
           images/powers/beta/<name>.png       -> public/images/sts2/powers-beta/<name>.webp
  events   images/events/<id>[_<suffix>].png   -> public/images/sts2/events/<id>[_<suffix>].webp

Usage:
  env PYTHONPATH=. python3 scripts/extract-entity-art.py [--kind relics] [--force] [--dry-run]
"""
from __future__ import annotations

import argparse
import io
import json
import re
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public/images/sts2"
KINDS = ("relics", "potions", "powers", "events")
RELIC_VARIANT_SUFFIXES = ("ironclad", "silent", "defect", "necrobinder", "regent", "fool")


def row_stems(kind: str) -> set[str]:
    rows = json.loads((REPO / f"data/sts2/eng/{kind}.json").read_text(encoding="utf-8"))
    stems = set()
    for row in rows:
        url = row.get("image_url")
        if kind in ("relics", "powers") and url:
            stems.add(Path(url).stem)
        if kind != "powers":
            # Relics with character variants (YUMMY_COOKIE) have no image_url.
            stems.add(row["id"].lower())
    return stems


def targets(kind: str, entries: list[str]) -> list[tuple[str, Path]]:
    stems = row_stems(kind)
    out: list[tuple[str, Path]] = []
    if kind == "relics":
        pattern = re.compile(r"images/relics/(beta/)?([^/]+)\.png\.import$")
    elif kind == "powers":
        pattern = re.compile(r"images/powers/(beta/)?([^/]+)\.png\.import$")
    elif kind == "potions":
        pattern = re.compile(r"images/potions/large/()([^/]+)\.png\.import$")
    else:
        pattern = re.compile(r"images/events/()([^/]+)\.png\.import$")
    for path in entries:
        m = pattern.match(path)
        if not m:
            continue
        beta, stem = bool(m.group(1)), m.group(2)
        if kind == "relics":
            base, _, suffix = stem.rpartition("_")
            wanted = stem in stems or (not beta and suffix in RELIC_VARIANT_SUFFIXES and base in stems)
        elif kind == "events":
            # Secondary portraits such as museum_of_torture_02 or *_foreground;
            # phobia-mode swaps belong to the phobia extractor.
            wanted = "phobia" not in stem and (stem in stems or any(stem.startswith(s + "_") for s in stems))
        else:
            wanted = stem in stems
        if wanted:
            out.append((path, OUT / (f"{kind}-beta" if beta else kind) / f"{stem}.webp"))
    return out


def encode(image) -> bytes:
    if image.mode == "RGBA" and image.getchannel("A").getextrema() == (255, 255):
        image = image.convert("RGB")
    buf = io.BytesIO()
    image.save(buf, "WEBP", quality=95, method=6)
    return buf.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pck", default=default_pck_path())
    parser.add_argument("--kind", choices=KINDS, action="append")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    reader = PCKReader(args.pck)
    entries = sorted(reader.entries)
    for kind in args.kind or KINDS:
        written = skipped = failed = 0
        for import_path, dest in targets(kind, entries):
            if dest.exists() and not args.force:
                skipped += 1
                continue
            ctex = parse_import_file(reader.read_file(import_path))
            image = ctex_to_image(reader.read_file(ctex)) if ctex and ctex in reader.entries else None
            if image is None:
                print(f"  [{kind}] could not decode {import_path}")
                failed += 1
                continue
            print(f"  [{kind}] {dest.relative_to(REPO)} {image.size[0]}x{image.size[1]}")
            if not args.dry_run:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(encode(image))
            written += 1
        print(f"[{kind}] wrote {written}, skipped {skipped}, failed {failed}")


if __name__ == "__main__":
    main()
