#!/usr/bin/env python3
"""Extract STS2 run badge assets and processed badge data.

Game source:
  - images/ui/game_over_screen/badge_*.png.import
  - localization/{eng,kor}/badges.json
  - MegaCrit.Sts2.Core.Models.Badges/*.cs from an ilspycmd decompile

Outputs:
  - public/images/sts2/badges/*.webp
  - data/sts2/{eng,kor}/badges.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT_DIR = ROOT / "public/images/sts2/badges"
DEFAULT_DATA_DIR = ROOT / "data/sts2"
DEFAULT_SRC_DIR = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Badges")

IMPORT_PREFIX = "images/ui/game_over_screen/badge_"
IMPORT_SUFFIX = ".png.import"
LOCALES = ("eng", "kor")
RARITIES = ("bronze", "silver", "gold")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--src-dir", default=str(DEFAULT_SRC_DIR), help="Decompiled Badge model source dir")
    parser.add_argument("--output", default=str(DEFAULT_OUT_DIR), help="Badge image output directory")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="Processed data/sts2 output directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing images")
    parser.add_argument("--dry-run", action="store_true", help="Print planned writes without writing files")
    return parser.parse_args()


def strip_badge_prefix(path: str) -> str | None:
    if not path.startswith(IMPORT_PREFIX) or not path.endswith(IMPORT_SUFFIX):
        return None
    return path[len(IMPORT_PREFIX) : -len(IMPORT_SUFFIX)]


def extract_images(reader: PCKReader, output_dir: Path, *, force: bool, dry_run: bool) -> tuple[list[str], int, int]:
    imports = sorted(path for path in reader.entries if strip_badge_prefix(path))
    slugs: list[str] = []
    written = 0
    skipped = 0

    for import_path in imports:
        slug = strip_badge_prefix(import_path)
        if slug is None:
            continue
        slugs.append(slug)
        output_path = output_dir / f"{slug}.webp"
        if output_path.exists() and not force:
            skipped += 1
            continue

        ctex_path = parse_import_file(reader.read_file(import_path))
        if not ctex_path or ctex_path not in reader.entries:
            raise RuntimeError(f"{import_path}: could not resolve .ctex path")
        image = ctex_to_image(reader.read_file(ctex_path))
        if image is None:
            raise RuntimeError(f"{import_path}: could not decode texture")

        if dry_run:
            print(f"would write {output_path} ({image.size[0]}x{image.size[1]})")
        else:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path, "WEBP", quality=95, method=6)
            print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")
        written += 1

    return slugs, written, skipped


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_active_class_names(src_dir: Path) -> set[str]:
    pool_path = src_dir / "BadgePool.cs"
    if not pool_path.exists():
        return set()
    text = read_text(pool_path)
    return set(re.findall(r"new\s+([A-Za-z0-9_]+)\s*\(", text))


def parse_badge_source_metadata(src_dir: Path) -> dict[str, dict[str, object]]:
    active_classes = parse_active_class_names(src_dir)
    metadata: dict[str, dict[str, object]] = {}
    if not src_dir.exists():
        return metadata

    ctor_re = re.compile(
        r":\s*base\(\s*run,\s*won,\s*playerId,\s*\"(?P<id>[A-Z0-9_]+)\"\s*,\s*"
        r"requiresWin:\s*(?P<requires>true|false)\s*,\s*"
        r"multiplayerOnly:\s*(?P<multi>true|false)\s*\)",
        re.MULTILINE,
    )

    for path in sorted(src_dir.glob("*.cs")):
        if path.name in {"Badge.cs", "BadgePool.cs", "BadgeRarity.cs"}:
            continue
        text = read_text(path)
        match = ctor_re.search(text)
        if not match:
            continue
        badge_id = match.group("id")
        metadata[badge_id] = {
            "active": path.stem in active_classes,
            "requiresWin": match.group("requires") == "true",
            "multiplayerOnly": match.group("multi") == "true",
            "sourceClass": path.stem,
        }
    return metadata


def load_badge_table(reader: PCKReader, locale: str) -> dict[str, str]:
    return reader.read_json(f"localization/{locale}/badges.json")


def badge_ids_from_tables(tables: dict[str, dict[str, str]]) -> set[str]:
    ids: set[str] = set()
    for table in tables.values():
        for key in table:
            if "." not in key:
                continue
            ids.add(key.split(".", 1)[0])
    return ids


def rarity_payload(table: dict[str, str], badge_id: str, rarity: str) -> dict[str, str] | None:
    title = table.get(f"{badge_id}.{rarity}Title")
    description = table.get(f"{badge_id}.{rarity}Description")
    if title is None and description is None:
        return None
    return {
        "title": title or table.get(f"{badge_id}.title", badge_id),
        "description": description or table.get(f"{badge_id}.description", ""),
    }


def build_catalog_for_locale(
    *,
    locale_table: dict[str, str],
    badge_ids: set[str],
    icon_slugs: set[str],
    source_metadata: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    catalog: list[dict[str, object]] = []
    for badge_id in sorted(badge_ids):
        slug = badge_id.lower()
        rarities = {
            rarity: payload
            for rarity in RARITIES
            if (payload := rarity_payload(locale_table, badge_id, rarity)) is not None
        }
        default_title = locale_table.get(f"{badge_id}.title")
        default_description = locale_table.get(f"{badge_id}.description")
        metadata = source_metadata.get(badge_id, {})
        catalog.append(
            {
                "id": badge_id,
                "slug": slug,
                "active": bool(metadata.get("active", False)),
                "requiresWin": metadata.get("requiresWin"),
                "multiplayerOnly": metadata.get("multiplayerOnly"),
                "sourceClass": metadata.get("sourceClass"),
                "imageUrl": f"/images/sts2/badges/{slug}.webp" if slug in icon_slugs else None,
                "title": default_title,
                "description": default_description,
                "rarities": rarities,
            }
        )
    return catalog


def write_json(path: Path, data: object, *, dry_run: bool) -> None:
    if dry_run:
        print(f"would write {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {path}")


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output)
    data_dir = Path(args.data_dir)
    src_dir = Path(args.src_dir)

    with PCKReader(args.pck) as reader:
        icon_slugs, written, skipped = extract_images(
            reader,
            output_dir,
            force=args.force,
            dry_run=args.dry_run,
        )
        source_metadata = parse_badge_source_metadata(src_dir)
        locale_tables = {locale: load_badge_table(reader, locale) for locale in LOCALES}
        badge_ids = badge_ids_from_tables(locale_tables) | set(source_metadata)

        icon_slug_set = set(icon_slugs)
        data = {
            locale: build_catalog_for_locale(
                locale_table=table,
                badge_ids=badge_ids,
                icon_slugs=icon_slug_set,
                source_metadata=source_metadata,
            )
            for locale, table in locale_tables.items()
        }

    for locale, catalog in data.items():
        write_json(data_dir / locale / "badges.json", catalog, dry_run=args.dry_run)

    print(f"done: {written} images written, {skipped} images skipped, {len(badge_ids)} badges")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
