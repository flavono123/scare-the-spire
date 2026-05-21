#!/usr/bin/env python3
"""Extract `vars` (default DynamicVar values) from decompiled STS2 entity
classes and inject them into data/sts2/{eng,kor}/{relics,potions,powers}.json.

These values back the `{Var}` templates that ship in description_raw, so
the codex bake step can render baked descriptions identical to the game.

Tracks the C# DynamicVar surface in
  /tmp/sts2-src/MegaCrit.Sts2.Core.Localization.DynamicVars/
and the entity directories
  /tmp/sts2-src/MegaCrit.Sts2.Core.Models.{Relics,Potions,Powers}/
Update DEFAULT_NAMES if MegaCrit adds a new XxxVar shorthand in a patch.

Usage:
  python3 scripts/parse-entity-vars.py [--source DIR] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "data/sts2"

# `XxxVar(value)` shorthand → name "Xxx" via const string defaultName = "Xxx".
DEFAULT_NAMES: dict[str, str] = {
    "BlockVar": "Block",
    "CardsVar": "Cards",
    "DamageVar": "Damage",
    "ExtraDamageVar": "ExtraDamage",
    "GoldVar": "Gold",
    "HealVar": "Heal",
    "MaxHpVar": "MaxHp",
    "StarsVar": "Stars",
    "EnergyVar": "Energy",
    "ForgeVar": "Forge",
    "RepeatVar": "Repeat",
    "SummonVar": "Summon",
    "HpLossVar": "HpLoss",
}

# Entity kinds we know how to extract.
ENTITY_KINDS = ("relics", "potions", "powers")

ENTITY_DIRS = {
    "relics": "MegaCrit.Sts2.Core.Models.Relics",
    "potions": "MegaCrit.Sts2.Core.Models.Potions",
    "powers": "MegaCrit.Sts2.Core.Models.Powers",
}

TITLE_REF_TABLES = {
    "Enchantment": "enchantments",
    "Affliction": "afflictions",
}

TITLE_REF_RE = re.compile(
    r"ModelDb\.(Enchantment|Affliction)<(\w+)>\(\)\.Title\.GetFormattedText\(\)"
)


def slugify(name: str) -> str:
    """PascalCase -> SCREAMING_SNAKE_CASE, mirroring StringHelper.Slugify."""
    out: list[str] = []
    for i, c in enumerate(name):
        if i > 0 and c.isupper():
            out.append("_")
        out.append(c.upper())
    return "".join(out)


def parse_decimal(s: str):
    s = s.strip().rstrip("m").rstrip("f")
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return None


def parse_title_ref(expr: str) -> dict[str, str] | None:
    match = TITLE_REF_RE.fullmatch(expr.strip())
    if not match:
        return None
    model_kind, class_name = match.groups()
    table = TITLE_REF_TABLES.get(model_kind)
    if not table:
        return None
    return {"__titleRef": table, "id": slugify(class_name)}


def split_top_level(args: str, delim: str = ",") -> list[str]:
    out: list[str] = []
    depth = 0
    last = 0
    for i, c in enumerate(args):
        if c in "({[<":
            depth += 1
        elif c in ")}]>":
            depth -= 1
        elif c == delim and depth == 0:
            out.append(args[last:i])
            last = i + 1
    out.append(args[last:])
    return [s.strip() for s in out]


def extract_canonical_block(text: str) -> str:
    """Return the expression after `CanonicalVars =>` up to its terminating `;`."""
    m = re.search(
        r"protected\s+override\s+IEnumerable<DynamicVar>\s+CanonicalVars\s*=>\s*",
        text,
    )
    if not m:
        return ""
    depth = 0
    j = m.end()
    while j < len(text):
        c = text[j]
        if c in "({[":
            depth += 1
        elif c in ")}]":
            depth -= 1
        elif c == ";" and depth == 0:
            return text[m.end() : j]
        j += 1
    return text[m.end() :]


def find_var_calls(block: str) -> list[tuple[str, str | None, str]]:
    """Find `new XxxVar<Generic>(args)` occurrences in `block`.

    Returns (className, genericArg|None, argsString) tuples.
    """
    results: list[tuple[str, str | None, str]] = []
    pat = re.compile(r"new\s+(\w+)(?:<([^>]+)>)?\s*\(")
    i = 0
    while i < len(block):
        m = pat.search(block, i)
        if not m:
            break
        cls = m.group(1)
        if not cls.endswith("Var"):
            i = m.end()
            continue
        depth = 1
        j = m.end()
        while j < len(block) and depth > 0:
            c = block[j]
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            j += 1
        if depth != 0:
            break
        args_str = block[m.end() : j - 1]
        results.append((cls, m.group(2), args_str))
        i = j
    return results


def parse_var(cls: str, generic: str | None, args_str: str):
    """Resolve one `new XxxVar(...)` to (name, value) or None to skip.

    Skips StringVars that depend on runtime state. Static title references are
    resolved per locale when writing each JSON file.
    """
    args = split_top_level(args_str) if args_str.strip() else []
    if not args:
        return None
    first = args[0]
    rest = args[1:]

    if cls == "StringVar":
        if first.startswith('"') and first.endswith('"') and rest:
            title_ref = parse_title_ref(rest[0])
            if title_ref:
                return (first[1:-1], title_ref)
        return None

    if cls == "PowerVar":
        if first.startswith('"') and first.endswith('"') and len(rest) >= 1:
            name = first[1:-1]
            value = parse_decimal(rest[0])
        else:
            if not generic:
                return None
            name = generic
            value = parse_decimal(first)
        return (name, value) if value is not None else None

    if cls in ("IntVar", "DynamicVar"):
        if first.startswith('"') and first.endswith('"') and len(rest) >= 1:
            return (first[1:-1], parse_decimal(rest[0])) if parse_decimal(rest[0]) is not None else None
        return None

    if cls in DEFAULT_NAMES:
        if first.startswith('"') and first.endswith('"') and len(rest) >= 1:
            name = first[1:-1]
            value = parse_decimal(rest[0])
        else:
            name = DEFAULT_NAMES[cls]
            value = parse_decimal(first)
        return (name, value) if value is not None else None

    return None


CLASS_RE = re.compile(
    r"public\s+(?:sealed\s+)?(?:abstract\s+)?(?:partial\s+)?class\s+(\w+)\b"
)


def class_name(text: str) -> str | None:
    m = CLASS_RE.search(text)
    return m.group(1) if m else None


def extract_vars_from_file(cs_path: Path) -> tuple[str | None, dict[str, Any]]:
    text = cs_path.read_text(encoding="utf-8")
    cls = class_name(text)
    block = extract_canonical_block(text)
    vars_: dict[str, Any] = OrderedDict()
    if block:
        for v_cls, generic, args in find_var_calls(block):
            parsed = parse_var(v_cls, generic, args)
            if parsed is None:
                continue
            name, value = parsed
            vars_.setdefault(name, value)
    return cls, vars_


def localized_titles(lang: str, table: str) -> dict[str, str]:
    path = DATA_DIR / lang / f"{table}.json"
    if not path.exists():
        return {}
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {row["id"]: row["name"] for row in rows if row.get("id") and row.get("name")}


def resolve_locale_vars(vars_: dict[str, Any], lang: str) -> dict[str, int | float | str]:
    resolved: dict[str, int | float | str] = OrderedDict()
    title_cache: dict[str, dict[str, str]] = {}
    for name, value in vars_.items():
        if isinstance(value, dict) and "__titleRef" in value:
            table = value["__titleRef"]
            title_cache.setdefault(table, localized_titles(lang, table))
            title = title_cache[table].get(value["id"])
            if title is None:
                continue
            resolved[name] = title
        else:
            resolved[name] = value
    return resolved


def merge_vars_into_file(json_path: Path, vars_by_id: dict[str, dict]) -> tuple[int, int]:
    """Update json_path's entries in place. Returns (updated, missing)."""
    data = json.loads(json_path.read_text(encoding="utf-8"))
    updated = 0
    missing = 0
    lang = json_path.parent.name
    for entry in data:
        eid = entry.get("id")
        if not eid:
            continue
        raw_vars = vars_by_id.get(eid)
        if raw_vars is None:
            missing += 1
            continue
        new_vars = resolve_locale_vars(raw_vars, lang)
        # Only set non-empty vars; empty dict means we found nothing useful.
        entry["vars"] = new_vars
        updated += 1
    json_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return updated, missing


def process_kind(kind: str, source_root: Path, dry_run: bool) -> None:
    src = source_root / ENTITY_DIRS[kind]
    if not src.is_dir():
        print(f"[{kind}] no source dir at {src}, skip")
        return
    vars_by_id: dict[str, dict] = {}
    for cs in sorted(src.glob("*.cs")):
        cls, vars_ = extract_vars_from_file(cs)
        if not cls:
            continue
        # Powers are registered as their class name minus the trailing "Power"
        # (e.g. AccelerantPower -> ACCELERANT); other kinds keep the class name.
        if kind == "powers" and cls.endswith("Power") and cls != "Power":
            cls = cls[: -len("Power")]
        vars_by_id[slugify(cls)] = vars_

    print(f"[{kind}] parsed {len(vars_by_id)} classes from {src}")
    sample = next(iter(vars_by_id.items()), None)
    if sample:
        print(f"  sample: {sample[0]} -> {sample[1]}")

    if dry_run:
        # Cross-check coverage.
        for lang in ("eng", "kor"):
            jp = DATA_DIR / lang / f"{kind}.json"
            if not jp.exists():
                continue
            data = json.loads(jp.read_text(encoding="utf-8"))
            ids = {e["id"] for e in data if "id" in e}
            covered = sum(1 for i in ids if i in vars_by_id)
            print(f"  [{lang}] {covered}/{len(ids)} ids matched")
        return

    for lang in ("eng", "kor"):
        jp = DATA_DIR / lang / f"{kind}.json"
        if not jp.exists():
            print(f"  [{lang}] no {jp}, skip")
            continue
        updated, missing = merge_vars_into_file(jp, vars_by_id)
        print(f"  [{lang}] updated {updated}, no-source {missing} -> {jp.relative_to(REPO)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("/tmp/sts2-src"),
        help="Decompiled DLL source root (default: /tmp/sts2-src)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--kind",
        choices=ENTITY_KINDS,
        action="append",
        help="Restrict to one or more kinds (default: all)",
    )
    args = parser.parse_args()
    kinds = args.kind or list(ENTITY_KINDS)
    for kind in kinds:
        process_kind(kind, args.source, args.dry_run)


if __name__ == "__main__":
    main()
