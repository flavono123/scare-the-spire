#!/usr/bin/env python3
"""Extract raw STS2 localization tables from the local game PCK.

This intentionally writes the game-owned localization layer separately from the
processed codex data in data/sts2/{eng,kor}. The output is the exact PCK text
for each language/table and should be treated as the truth table for game
i18n, including typos and patched wording.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.pck import PCKReader, default_pck_path  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/sts2"
DEFAULT_OUT_DIR = DATA_DIR / "localization"
LANGUAGES_PATH = DATA_DIR / "languages.json"


def load_language_codes() -> list[str]:
    languages = json.loads(LANGUAGES_PATH.read_text(encoding="utf-8"))
    return [entry["code"] for entry in languages]


def parse_csv_arg(raw: str | None, all_values: list[str]) -> list[str]:
    if raw is None or raw == "all":
        return all_values
    values = [item.strip() for item in raw.split(",") if item.strip()]
    unknown = sorted(set(values) - set(all_values))
    if unknown:
        raise SystemExit(f"Unknown value(s): {', '.join(unknown)}")
    return values


def discover_tables(reader: PCKReader, langs: list[str]) -> list[str]:
    tables: set[str] = set()
    lang_set = set(langs)
    for entry_path in reader.entries:
        parts = entry_path.split("/")
        if len(parts) == 3 and parts[0] == "localization" and parts[1] in lang_set:
            if parts[2].endswith(".json"):
                tables.add(parts[2].removesuffix(".json"))
    return sorted(tables)


def pck_fingerprint(pck_path: Path) -> dict[str, object]:
    stat = pck_path.stat()
    h = hashlib.sha256()
    with pck_path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return {
        "path": str(pck_path),
        "size": stat.st_size,
        "sha256": h.hexdigest(),
    }


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract raw STS2 PCK localization tables.")
    ap.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Output directory")
    ap.add_argument("--langs", default="all", help="Comma-separated language codes, or all")
    ap.add_argument("--tables", default="all", help="Comma-separated table names without .json, or all")
    ap.add_argument("--dry-run", action="store_true", help="Print planned writes without writing files")
    args = ap.parse_args()

    pck_path = Path(args.pck).expanduser()
    out_dir = Path(args.out_dir)
    all_langs = load_language_codes()

    reader = PCKReader(str(pck_path))
    try:
        langs = parse_csv_arg(args.langs, all_langs)
        all_tables = discover_tables(reader, langs)
        tables = parse_csv_arg(args.tables, all_tables)

        planned = 0
        missing: list[str] = []
        for lang in langs:
            for table in tables:
                pck_entry = f"localization/{lang}/{table}.json"
                if pck_entry not in reader.entries:
                    missing.append(pck_entry)
                    continue
                planned += 1

        print(f"PCK: {pck_path}")
        print(f"Languages: {len(langs)} ({', '.join(langs)})")
        print(f"Tables: {len(tables)}")
        print(f"Localization files: {planned}")
        if missing:
            print(f"Missing files: {len(missing)}", file=sys.stderr)
            for item in missing[:20]:
                print(f"  - {item}", file=sys.stderr)
            if len(missing) > 20:
                print(f"  ... {len(missing) - 20} more", file=sys.stderr)

        if args.dry_run:
            print("(dry-run: no files written)")
            return 0

        for lang in langs:
            for table in tables:
                pck_entry = f"localization/{lang}/{table}.json"
                if pck_entry not in reader.entries:
                    continue
                write_json(out_dir / lang / f"{table}.json", reader.read_json(pck_entry))

        manifest = {
            "schemaVersion": 1,
            "pck": pck_fingerprint(pck_path),
            "languages": langs,
            "tables": tables,
            "fileCount": planned,
        }
        write_json(out_dir / "manifest.json", manifest)
        print(f"Wrote {planned} localization files to {out_dir}")
        print(f"Wrote {out_dir / 'manifest.json'}")
        return 0
    finally:
        reader.close()


if __name__ == "__main__":
    raise SystemExit(main())
