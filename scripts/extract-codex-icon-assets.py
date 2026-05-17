#!/usr/bin/env python3
"""Extract STS2 Codex icon assets from the local PCK.

Sources:
- `images/relics/*.png.import` -> `public/images/sts2/relics/*.webp`
- `images/relics/beta/*.png.import` -> `public/images/sts2/relics-beta/*.webp`
- `images/powers/*.png.import` -> `public/images/sts2/powers/*.webp`
- `images/powers/beta/*.png.import` -> `public/images/sts2/powers-beta/*.webp`
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


OUT_ROOT = ROOT / "public/images/sts2"
DATA_ROOT = ROOT / "data/sts2/kor"
IMPORT_RE = re.compile(r"^images/(?P<kind>relics|powers)/(?:(?P<beta>beta)/)?(?P<name>[^/]+)\.png\.import$")
STATIC_IMAGE_RE = re.compile(r"^/static/images/(?P<kind>relics|powers)/(?P<name>[^/]+)\.png$")


@dataclass(frozen=True)
class Target:
    kind: str
    beta: bool
    name: str
    import_path: str
    output_path: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--kind",
        choices=("all", "relics", "powers"),
        default="all",
        help="Asset kind to extract",
    )
    parser.add_argument("--output-root", default=str(OUT_ROOT), help="Output root directory")
    parser.add_argument("--force", action="store_true", help="Refresh existing files")
    parser.add_argument("--dry-run", action="store_true", help="List work without writing files")
    parser.add_argument("--offset", type=int, default=0, help="Start at this target index after sorting")
    parser.add_argument("--limit", type=int, help="Maximum number of sorted targets to process")
    parser.add_argument(
        "--prune-stale",
        action="store_true",
        help="Delete output files that no longer have a matching PCK import",
    )
    parser.add_argument(
        "--audit-data",
        action="store_true",
        help="Report data/sts2 image_url entries that have no matching official PCK import",
    )
    return parser.parse_args()


def output_subdir(kind: str, beta: bool) -> str:
    if kind == "relics" and beta:
        return "relics-beta"
    if kind == "powers" and beta:
        return "powers-beta"
    return kind


def discover_targets(reader: PCKReader, output_root: Path, kind_filter: str) -> list[Target]:
    targets: list[Target] = []
    for import_path in reader.entries:
        match = IMPORT_RE.match(import_path)
        if not match:
            continue
        kind = match.group("kind")
        if kind_filter != "all" and kind != kind_filter:
            continue
        beta = match.group("beta") == "beta"
        name = match.group("name")
        targets.append(
            Target(
                kind=kind,
                beta=beta,
                name=name,
                import_path=import_path,
                output_path=output_root / output_subdir(kind, beta) / f"{name}.webp",
            )
        )
    return sorted(targets, key=lambda t: (t.kind, t.beta, t.name))


def encode_webp(reader: PCKReader, import_path: str) -> bytes | None:
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        return None
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        return None
    output = io.BytesIO()
    image.save(output, "WEBP", quality=95, method=6)
    return output.getvalue()


def extract_targets(reader: PCKReader, targets: list[Target], force: bool, dry_run: bool) -> tuple[int, int, int, int]:
    written = 0
    unchanged = 0
    skipped = 0
    failed = 0

    for target in targets:
        if target.output_path.exists() and not force:
            skipped += 1
            continue

        data = encode_webp(reader, target.import_path)
        if data is None:
            print(f"skip {target.import_path}: decode failed")
            failed += 1
            continue

        status = "write"
        if target.output_path.exists() and target.output_path.read_bytes() == data:
            status = "same"
            unchanged += 1
        else:
            written += 1

        if dry_run:
            print(f"would {status} {target.output_path}")
            continue

        if status == "write":
            target.output_path.parent.mkdir(parents=True, exist_ok=True)
            target.output_path.write_bytes(data)
            print(f"wrote {target.output_path}")

    return written, unchanged, skipped, failed


def prune_stale(output_root: Path, targets: list[Target], kind_filter: str, dry_run: bool) -> int:
    expected = {target.output_path for target in targets}
    dirs = ["relics", "relics-beta", "powers", "powers-beta"]
    if kind_filter == "relics":
        dirs = ["relics", "relics-beta"]
    elif kind_filter == "powers":
        dirs = ["powers", "powers-beta"]

    removed = 0
    for subdir in dirs:
        directory = output_root / subdir
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.webp")):
            if path in expected:
                continue
            removed += 1
            if dry_run:
                print(f"would remove stale {path}")
            else:
                path.unlink()
                print(f"removed stale {path}")
    return removed


def audit_data_refs(targets: list[Target], kind_filter: str) -> int:
    official_names = {(target.kind, target.name) for target in targets if not target.beta}
    missing = 0
    files: list[tuple[str, Path]] = []
    if kind_filter in ("all", "relics"):
        files.append(("relics", DATA_ROOT / "relics.json"))
    if kind_filter in ("all", "powers"):
        files.append(("powers", DATA_ROOT / "powers.json"))

    for kind, path in files:
        rows = json.loads(path.read_text())
        for row in rows:
            image_url = row.get("image_url")
            if not isinstance(image_url, str):
                continue
            match = STATIC_IMAGE_RE.match(image_url)
            if not match or match.group("kind") != kind:
                continue
            name = match.group("name")
            if (kind, name) in official_names:
                continue
            missing += 1
            print(f"data image has no official import: {kind}/{row.get('id')} -> {image_url}")
    return missing


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root)

    with PCKReader(args.pck) as reader:
        all_targets = discover_targets(reader, output_root, args.kind)
        official = sum(1 for target in all_targets if not target.beta)
        beta = sum(1 for target in all_targets if target.beta)
        print(f"found {len(all_targets)} icon imports ({official} official, {beta} beta)")

        missing_refs = audit_data_refs(all_targets, args.kind) if args.audit_data else 0
        targets = all_targets[args.offset :]
        if args.limit is not None:
            targets = targets[: args.limit]
        if args.offset or args.limit is not None:
            print(f"processing {len(targets)} targets from offset {args.offset}")
        written, unchanged, skipped, failed = extract_targets(reader, targets, args.force, args.dry_run)
        removed = prune_stale(output_root, all_targets, args.kind, args.dry_run) if args.prune_stale else 0

    prefix = "(dry-run) " if args.dry_run else ""
    print(
        f"{prefix}done: {written} written, {unchanged} unchanged, "
        f"{skipped} skipped, {removed} stale removed, {failed} failed, {missing_refs} missing data refs"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
