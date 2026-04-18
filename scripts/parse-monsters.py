#!/usr/bin/env python3
"""Parse monsters from the local STS2 PCK + decompiled DLL source.

Writes data/sts2/{eng,kor}/monsters.json, preserving the existing schema.

Data sources:
- Initial HP (base + ascension) and the authoritative move list come from the
  decompiled .cs class file — DLL is source of truth for gameplay data.
- Move titles and display names come from the PCK localization tables.
- Damage/block numbers are pulled from `private int XxxDamage => ...` properties.

Prerequisites:
- Local STS2 install (PCK auto-detected)
- Decompiled DLL source at /tmp/sts2-src (default). Produce with:
    ilspycmd -p -o /tmp/sts2-src "<sts2.dll path>"
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
DEFAULT_SOURCE = Path("/tmp/sts2-src")
SKIP_PREFIXES = ("DEPRECATED_", "MOCK_", "ATTACK_MOVE_MONSTER", "BIG_DUMMY")

MONSTER_NAMESPACES = [
    "MegaCrit.Sts2.Core.Models.Monsters",
    "MegaCrit.Sts2.Core.Models.Events",
]

_HP_ASC_RE = re.compile(
    r"public\s+override\s+int\s+(?P<field>MinInitialHp|MaxInitialHp)\s*=>\s*"
    r"AscensionHelper\.GetValueIfAscension\([^,]+,\s*(?P<asc>\d+)\s*,\s*(?P<base>\d+)\s*\)\s*;"
)
_HP_PLAIN_RE = re.compile(
    r"public\s+override\s+int\s+(?P<field>MinInitialHp|MaxInitialHp)\s*=>\s*(?P<base>\d+)\s*;"
)
_INT_PROP_ASC_RE = re.compile(
    r"(?:public|private|protected)\s+(?:static\s+)?int\s+(?P<name>\w+)\s*=>\s*"
    r"AscensionHelper\.GetValueIfAscension\([^,]+,\s*(?P<asc>\d+)\s*,\s*(?P<base>\d+)\s*\)\s*;"
)
_INT_PROP_PLAIN_RE = re.compile(
    r"(?:public|private|protected)\s+(?:static\s+)?int\s+(?P<name>\w+)\s*=>\s*(?P<val>\d+)\s*;"
)
_MOVESTATE_START_RE = re.compile(r'new\s+MoveState\(\s*"(?P<id>\w+)"')
_INTENT_RE = re.compile(r"new\s+(?P<kind>\w+Intent)\s*\((?P<args>[^)]*)\)")


def _balanced_span(text: str, start: int) -> int:
    """Given an index of '(', return the index of matching ')'; -1 if none."""
    depth = 0
    i = start
    while i < len(text):
        c = text[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def pascal_case(snake: str) -> str:
    return "".join(w.capitalize() for w in snake.split("_"))


def find_monster_class(source_root: Path, ent_id: str) -> Path | None:
    class_name = pascal_case(ent_id)
    for ns in MONSTER_NAMESPACES:
        p = source_root / ns / f"{class_name}.cs"
        if p.is_file():
            return p
    return None


def parse_hp(text: str) -> dict:
    out = {"min_hp": None, "max_hp": None, "min_hp_ascension": None, "max_hp_ascension": None}
    for m in _HP_ASC_RE.finditer(text):
        if m.group("field") == "MinInitialHp":
            out["min_hp"] = int(m.group("base"))
            out["min_hp_ascension"] = int(m.group("asc"))
        else:
            out["max_hp"] = int(m.group("base"))
            out["max_hp_ascension"] = int(m.group("asc"))
    for m in _HP_PLAIN_RE.finditer(text):
        if m.group("field") == "MinInitialHp" and out["min_hp"] is None:
            out["min_hp"] = int(m.group("base"))
        elif m.group("field") == "MaxInitialHp" and out["max_hp"] is None:
            out["max_hp"] = int(m.group("base"))
    return out


def parse_int_props(text: str) -> dict[str, dict]:
    """Return {prop_name: {normal, ascension}} for every int property, inc. plain ints."""
    out: dict[str, dict] = {}
    for m in _INT_PROP_ASC_RE.finditer(text):
        out[m.group("name")] = {
            "normal": int(m.group("base")),
            "ascension": int(m.group("asc")),
        }
    for m in _INT_PROP_PLAIN_RE.finditer(text):
        name = m.group("name")
        if name not in out:
            out[name] = {"normal": int(m.group("val")), "ascension": None}
    return out


def strip_move_suffix(move_id: str) -> str:
    return move_id[:-5] if move_id.endswith("_MOVE") else move_id


def resolve_move_title(loc_entry: dict, move_id: str) -> str | None:
    """Try locale under the full ID and the suffix-stripped ID, both title and _self."""
    moves = loc_entry.get("moves", {}) or {}
    for key in (move_id, strip_move_suffix(move_id)):
        node = moves.get(key)
        if isinstance(node, dict):
            title = node.get("title") or node.get("_self")
            if title:
                return title
        elif isinstance(node, str):
            return node
    return None


def parse_moves_and_damage(text: str) -> tuple[list[str], dict, dict]:
    """Return (ordered move ids, damage_values map, block_values map)."""
    int_props = parse_int_props(text)
    move_ids: list[str] = []
    damage_values: dict[str, dict] = {}
    block_values: dict[str, dict] = {}

    for m in _MOVESTATE_START_RE.finditer(text):
        move_id = m.group("id")
        if move_id not in move_ids:
            move_ids.append(move_id)
        # Walk forward to the matching ')' of the MoveState constructor.
        # m.start() points at "new MoveState", so the '(' is between there and m.end().
        open_paren = text.find("(", m.start(), m.end())
        if open_paren < 0:
            continue
        close_paren = _balanced_span(text, open_paren)
        if close_paren < 0:
            continue
        body = text[open_paren + 1 : close_paren]
        for intent_match in _INTENT_RE.finditer(body):
            kind = intent_match.group("kind")
            args = [a.strip() for a in intent_match.group("args").split(",") if a.strip()]
            if not args:
                continue
            first = args[0]
            # Attack intents carry a Damage identifier as the first arg.
            if kind in ("SingleAttackIntent", "MultiAttackIntent", "DeathBlowIntent", "AttackIntent"):
                prop = int_props.get(first)
                if prop is not None:
                    dmg_key = first[:-len("Damage")] if first.endswith("Damage") else first
                    damage_values.setdefault(dmg_key, prop)
            # Defend intents optionally carry a Block identifier.
            if kind == "DefendIntent" and first:
                prop = int_props.get(first)
                if prop is not None:
                    blk_key = first[:-len("Block")] if first.endswith("Block") else first
                    block_values.setdefault(blk_key, prop)
    return move_ids, damage_values, block_values


def build_entries(
    loc_kor_by_id: dict,
    loc_eng_by_id: dict,
    existing_kor: list,
    existing_eng: list,
    source_root: Path,
) -> tuple[list, list, list, list]:
    ids = sorted(set(loc_kor_by_id) | set(loc_eng_by_id))
    ids = [i for i in ids if not i.startswith(SKIP_PREFIXES)]

    old_kor_by_id = {e["id"]: e for e in existing_kor}
    old_eng_by_id = {e["id"]: e for e in existing_eng}

    kor_out, eng_out = [], []
    added, removed = [], []

    for ent_id in ids:
        cs = find_monster_class(source_root, ent_id)
        if cs is not None:
            text = cs.read_text()
            hp = parse_hp(text)
            move_ids, damage_values, block_values = parse_moves_and_damage(text)
        else:
            hp = {"min_hp": None, "max_hp": None, "min_hp_ascension": None, "max_hp_ascension": None}
            move_ids, damage_values, block_values = [], {}, {}

        # If no class-derived moves, fall back to whatever the locale lists.
        locale_fallback_moves = None
        if not move_ids:
            locale_fallback_moves = list((loc_kor_by_id.get(ent_id, {}).get("moves") or {}).keys())

        for lang, loc_by_id, old_by_id, out in (
            ("kor", loc_kor_by_id, old_kor_by_id, kor_out),
            ("eng", loc_eng_by_id, old_eng_by_id, eng_out),
        ):
            lnode = loc_by_id.get(ent_id, {})
            old = old_by_id.get(ent_id, {})

            if move_ids:
                moves = []
                for mid in move_ids:
                    stripped = strip_move_suffix(mid)
                    moves.append({
                        "id": stripped,
                        "name": resolve_move_title(lnode, mid) or stripped.replace("_", " ").title(),
                    })
            elif locale_fallback_moves:
                moves = []
                for mid in locale_fallback_moves:
                    moves.append({
                        "id": mid,
                        "name": resolve_move_title(lnode, mid) or mid.replace("_", " ").title(),
                    })
            else:
                moves = old.get("moves") or []

            out.append({
                "id": ent_id,
                "name": lnode.get("name") or old.get("name"),
                "type": old.get("type") or "Normal",
                **hp,
                "moves": moves,
                "damage_values": damage_values or old.get("damage_values"),
                "block_values": block_values or old.get("block_values"),
                "image_url": old.get("image_url"),
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
    ap = argparse.ArgumentParser(description="Parse monsters from PCK + DLL source.")
    ap.add_argument("--pck", default=default_pck_path())
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    source = Path(args.source)
    if not source.exists():
        print(f"ERROR: decompiled source not found at {source}", file=sys.stderr)
        return 1

    reader = PCKReader(args.pck)
    try:
        loc_kor = group_loc_by_id(reader.read_json("localization/kor/monsters.json"))
        loc_eng = group_loc_by_id(reader.read_json("localization/eng/monsters.json"))
    finally:
        reader.close()

    existing_kor = json.loads((DATA_DIR / "kor/monsters.json").read_text() or "[]")
    existing_eng = json.loads((DATA_DIR / "eng/monsters.json").read_text() or "[]")

    kor_out, eng_out, added, removed = build_entries(
        loc_kor, loc_eng, existing_kor, existing_eng, source
    )

    print(f"Monsters: {len(kor_out)} entries")
    if added:
        print(f"  + Added ({len(added)}): {', '.join(added)}")
    if removed:
        print(f"  - Removed ({len(removed)}): {', '.join(removed)}")

    if args.dry_run:
        print("(dry-run: no files written)")
        return 0

    write_json(DATA_DIR / "kor/monsters.json", kor_out)
    write_json(DATA_DIR / "eng/monsters.json", eng_out)
    print(f"Wrote {DATA_DIR / 'kor/monsters.json'}")
    print(f"Wrote {DATA_DIR / 'eng/monsters.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
