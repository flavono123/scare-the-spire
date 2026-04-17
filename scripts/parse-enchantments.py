#!/usr/bin/env python3
"""Parse enchantments from the local STS2 PCK + decompiled DLL source.

Writes data/sts2/{eng,kor}/enchantments.json, preserving the existing schema.

Prerequisites:
- Local STS2 install (PCK auto-detected)
- Decompiled DLL source at /tmp/sts2-src (default) or --source PATH
  Produce with: ilspycmd -p -o /tmp/sts2-src "<path to sts2.dll>"

Usage:
    python3 scripts/parse-enchantments.py [--dry-run] [--source PATH]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.pck import PCKReader, default_pck_path, group_loc_by_id  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/sts2"
ENCHANT_IMG_DIR = ROOT / "public/images/sts2/enchantments"
DEFAULT_SOURCE = Path("/tmp/sts2-src")
SKIP_PREFIXES = ("DEPRECATED_", "MOCK_")


def pascal_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def collect_classes(source_root: Path) -> dict[str, Path]:
    """Map SCREAMING_SNAKE id → .cs file for Enchantments."""
    result = {}
    d = source_root / "MegaCrit.Sts2.Core.Models.Enchantments"
    if not d.is_dir():
        return result
    for cs in d.glob("*.cs"):
        cls = cs.stem
        if cls in {"Mocks"}:
            continue
        result[pascal_to_snake(cls).upper()] = cs
    return result


def parse_flags(cs_path: Path) -> dict:
    text = cs_path.read_text()
    out = {
        "has_extra_card_text": bool(re.search(r"HasExtraCardText\s*=>\s*true", text)),
        "is_stackable": bool(re.search(r"IsStackable\s*=>\s*true", text)),
        "card_type": None,
    }
    m = re.search(
        r"CanEnchantCardType\([^)]*\)\s*\{\s*return\s*cardType\s*==\s*CardType\.(\w+)\s*;",
        text,
        re.S,
    )
    if m:
        out["card_type"] = m.group(1)
    return out


def image_url_for(ent_id: str) -> str | None:
    slug = ent_id.lower()
    for ext in ("webp", "png"):
        if (ENCHANT_IMG_DIR / f"{slug}.{ext}").exists():
            return f"/images/sts2/enchantments/{slug}.{ext}"
    return None


_CHOOSE_RE = re.compile(r"^\w+:choose\([^)]*\):(.*)$")


def _repl_placeholder(m: re.Match) -> str:
    body = m.group(0)[1:-1]
    cm = _CHOOSE_RE.match(body)
    if cm:
        branches = cm.group(1).split("|")
        return branches[-1]
    return "X"


def strip_dynamic_vars(text: str | None) -> str | None:
    """Collapse SmartFormat placeholders: {var}/{var:fmt()} → X, {var:choose():a|b} → default branch."""
    if text is None:
        return None
    return re.sub(r"\{[^{}]+\}", _repl_placeholder, text)


def build_entries(
    loc_kor: dict, loc_eng: dict, classes: dict[str, Path], existing_kor: list, existing_eng: list
) -> tuple[list[dict], list[dict], list[str], list[str]]:
    ids = sorted(set(loc_kor) | set(loc_eng))
    ids = [i for i in ids if not i.startswith(SKIP_PREFIXES)]

    old_kor_by_id = {e["id"]: e for e in existing_kor}
    old_eng_by_id = {e["id"]: e for e in existing_eng}

    kor_out, eng_out = [], []
    added, removed = [], []

    for ent_id in ids:
        cs = classes.get(ent_id)
        flags = parse_flags(cs) if cs else {
            "has_extra_card_text": False,
            "is_stackable": False,
            "card_type": None,
        }

        for lang, loc, old_by_id, out in (
            ("kor", loc_kor, old_kor_by_id, kor_out),
            ("eng", loc_eng, old_eng_by_id, eng_out),
        ):
            lnode = loc.get(ent_id, {})
            title = lnode.get("title")
            desc_raw = lnode.get("description")
            extra_raw = lnode.get("extraCardText") if flags["has_extra_card_text"] else None

            old = old_by_id.get(ent_id, {})
            out.append({
                "id": ent_id,
                "name": title or old.get("name"),
                "description": strip_dynamic_vars(desc_raw),
                "description_raw": desc_raw,
                "extra_card_text": strip_dynamic_vars(extra_raw),
                "card_type": flags["card_type"],
                "is_stackable": flags["is_stackable"],
                "image_url": image_url_for(ent_id) or old.get("image_url"),
            })

        if ent_id not in old_kor_by_id:
            added.append(ent_id)

    pck_ids = set(ids)
    for old_id in old_kor_by_id:
        if old_id not in pck_ids:
            removed.append(old_id)

    return kor_out, eng_out, added, removed


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="Parse enchantments from PCK + DLL source.")
    ap.add_argument("--pck", default=default_pck_path(), help="Path to STS2 .pck")
    ap.add_argument("--source", default=str(DEFAULT_SOURCE), help="Decompiled DLL source root")
    ap.add_argument("--dry-run", action="store_true", help="Print diff, do not write")
    args = ap.parse_args()

    source = Path(args.source)
    if not source.exists():
        print(f"ERROR: decompiled source not found at {source}", file=sys.stderr)
        print("Run: ilspycmd -p -o /tmp/sts2-src <sts2.dll path>", file=sys.stderr)
        return 1

    reader = PCKReader(args.pck)
    try:
        loc_kor = group_loc_by_id(reader.read_json("localization/kor/enchantments.json"))
        loc_eng = group_loc_by_id(reader.read_json("localization/eng/enchantments.json"))
    finally:
        reader.close()

    classes = collect_classes(source)

    existing_kor = json.loads((DATA_DIR / "kor/enchantments.json").read_text() or "[]")
    existing_eng = json.loads((DATA_DIR / "eng/enchantments.json").read_text() or "[]")

    kor_out, eng_out, added, removed = build_entries(
        loc_kor, loc_eng, classes, existing_kor, existing_eng
    )

    print(f"Enchantments: {len(kor_out)} entries")
    if added:
        print(f"  + Added ({len(added)}): {', '.join(added)}")
    if removed:
        print(f"  - Removed ({len(removed)}): {', '.join(removed)}")

    if args.dry_run:
        print("(dry-run: no files written)")
        return 0

    write_json(DATA_DIR / "kor/enchantments.json", kor_out)
    write_json(DATA_DIR / "eng/enchantments.json", eng_out)
    print(f"Wrote {DATA_DIR / 'kor/enchantments.json'}")
    print(f"Wrote {DATA_DIR / 'eng/enchantments.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
